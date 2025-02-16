/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { isPromiseCanceledError } from 'vs/base/common/errors';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { URI, UriComponents } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { isNative } from 'vs/base/common/platform';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILabelService } from 'vs/platform/label/common/label';
import { IFileMatch, IPatternInfo, ISearchProgressItem, ISearchService } from 'vs/workbench/services/search/common/search';
import { IWorkspaceContextService, WorkbenchState, IWorkspace } from 'vs/platform/workspace/common/workspace';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { ITextQueryBuilderOptions, QueryBuilder } from 'vs/workbench/contrib/search/common/queryBuilder';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IWorkspaceEditingService } from 'vs/workbench/services/workspace/common/workspaceEditing';
import { ExtHostContext, ExtHostWorkspaceShape, IExtHostContext, MainContext, MainThreadWorkspaceShape, IWorkspaceData, ITextSearchComplete } from '../common/extHost.protocol';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { isEqualOrParent } from 'vs/base/common/resources';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { withNullAsUndefined } from 'vs/base/common/types';
import { IFileService } from 'vs/platform/files/common/files';
import { IRequestService } from 'vs/platform/request/common/request';

@extHostNamedCustomer(MainContext.MainThreadWorkspace)
export class MainThreadWorkspace implements MainThreadWorkspaceShape {

	private readonly _toDispose = new DisposableStore();
	private readonly _activeCancelTokens: { [id: number]: CancellationTokenSource } = Object.create(null);
	private readonly _proxy: ExtHostWorkspaceShape;
	private readonly _queryBuilder = this._instantiationService.createInstance(QueryBuilder);

	constructor(
		extHostContext: IExtHostContext,
		@ISearchService private readonly _searchService: ISearchService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
		@ITextFileService private readonly _textFileService: ITextFileService,
		@IWorkspaceEditingService private readonly _workspaceEditingService: IWorkspaceEditingService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IRequestService private readonly _requestService: IRequestService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@ILabelService private readonly _labelService: ILabelService,
		@IEnvironmentService private readonly _environmentService: IEnvironmentService,
		@IFileService fileService: IFileService
	) {
		this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostWorkspace);
		const workspace = this._contextService.getWorkspace();
		// The workspace file is provided be a unknown file system provider. It might come
		// from the extension host. So initialize now knowing that `rootPath` is undefined.
		if (workspace.configuration && !isNative && !fileService.canHandleResource(workspace.configuration)) {
			this._proxy.$initializeWorkspace(this.getWorkspaceData(workspace));
		} else {
			this._contextService.getCompleteWorkspace().then(workspace => this._proxy.$initializeWorkspace(this.getWorkspaceData(workspace)));
		}
		this._contextService.onDidChangeWorkspaceFolders(this._onDidChangeWorkspace, this, this._toDispose);
		this._contextService.onDidChangeWorkbenchState(this._onDidChangeWorkspace, this, this._toDispose);
	}

	dispose(): void {
		this._toDispose.dispose();

		for (let requestId in this._activeCancelTokens) {
			const tokenSource = this._activeCancelTokens[requestId];
			tokenSource.cancel();
		}
	}

	// --- workspace ---

	$updateWorkspaceFolders(extensionName: string, index: number, deleteCount: number, foldersToAdd: { uri: UriComponents, name?: string }[]): Promise<void> {
		const workspaceFoldersToAdd = foldersToAdd.map(f => ({ uri: URI.revive(f.uri), name: f.name }));

		// Indicate in status message
		this._notificationService.status(this.getStatusMessage(extensionName, workspaceFoldersToAdd.length, deleteCount), { hideAfter: 10 * 1000 /* 10s */ });

		return this._workspaceEditingService.updateFolders(index, deleteCount, workspaceFoldersToAdd, true);
	}

	private getStatusMessage(extensionName: string, addCount: number, removeCount: number): string {
		let message: string;

		const wantsToAdd = addCount > 0;
		const wantsToDelete = removeCount > 0;

		// Add Folders
		if (wantsToAdd && !wantsToDelete) {
			if (addCount === 1) {
				message = localize('folderStatusMessageAddSingleFolder', "Extension '{0}' added 1 folder to the workspace", extensionName);
			} else {
				message = localize('folderStatusMessageAddMultipleFolders', "Extension '{0}' added {1} folders to the workspace", extensionName, addCount);
			}
		}

		// Delete Folders
		else if (wantsToDelete && !wantsToAdd) {
			if (removeCount === 1) {
				message = localize('folderStatusMessageRemoveSingleFolder', "Extension '{0}' removed 1 folder from the workspace", extensionName);
			} else {
				message = localize('folderStatusMessageRemoveMultipleFolders', "Extension '{0}' removed {1} folders from the workspace", extensionName, removeCount);
			}
		}

		// Change Folders
		else {
			message = localize('folderStatusChangeFolder', "Extension '{0}' changed folders of the workspace", extensionName);
		}

		return message;
	}

	private _onDidChangeWorkspace(): void {
		this._proxy.$acceptWorkspaceData(this.getWorkspaceData(this._contextService.getWorkspace()));
	}

	private getWorkspaceData(workspace: IWorkspace): IWorkspaceData | null {
		if (this._contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
			return null;
		}
		return {
			configuration: workspace.configuration || undefined,
			isUntitled: workspace.configuration ? isEqualOrParent(workspace.configuration, this._environmentService.untitledWorkspacesHome) : false,
			folders: workspace.folders,
			id: workspace.id,
			name: this._labelService.getWorkspaceLabel(workspace)
		};
	}

	// --- search ---

	$startFileSearch(includePattern: string | null, _includeFolder: UriComponents | null, excludePatternOrDisregardExcludes: string | false | null, maxResults: number | null, token: CancellationToken): Promise<UriComponents[] | null> {
		const includeFolder = URI.revive(_includeFolder);
		const workspace = this._contextService.getWorkspace();
		if (!workspace.folders.length) {
			return Promise.resolve(null);
		}

		const query = this._queryBuilder.file(
			includeFolder ? [includeFolder] : workspace.folders.map(f => f.uri),
			{
				maxResults: withNullAsUndefined(maxResults),
				disregardExcludeSettings: (excludePatternOrDisregardExcludes === false) || undefined,
				disregardSearchExcludeSettings: true,
				disregardIgnoreFiles: true,
				includePattern: withNullAsUndefined(includePattern),
				excludePattern: typeof excludePatternOrDisregardExcludes === 'string' ? excludePatternOrDisregardExcludes : undefined,
				_reason: 'startFileSearch'
			});

		return this._searchService.fileSearch(query, token).then(result => {
			return result.results.map(m => m.resource);
		}, err => {
			if (!isPromiseCanceledError(err)) {
				return Promise.reject(err);
			}
			return undefined;
		});
	}

	$startTextSearch(pattern: IPatternInfo, options: ITextQueryBuilderOptions, requestId: number, token: CancellationToken): Promise<ITextSearchComplete> {
		const workspace = this._contextService.getWorkspace();
		const folders = workspace.folders.map(folder => folder.uri);

		const query = this._queryBuilder.text(pattern, folders, options);
		query._reason = 'startTextSearch';

		const onProgress = (p: ISearchProgressItem) => {
			if ((<IFileMatch>p).results) {
				this._proxy.$handleTextSearchResult(<IFileMatch>p, requestId);
			}
		};

		const search = this._searchService.textSearch(query, token, onProgress).then(
			result => {
				return { limitHit: result.limitHit };
			},
			err => {
				if (!isPromiseCanceledError(err)) {
					return Promise.reject(err);
				}

				return undefined;
			});

		return search;
	}

	$checkExists(folders: UriComponents[], includes: string[], token: CancellationToken): Promise<boolean> {
		const queryBuilder = this._instantiationService.createInstance(QueryBuilder);
		const query = queryBuilder.file(folders.map(folder => URI.revive(folder)), {
			_reason: 'checkExists',
			includePattern: includes.join(', '),
			expandPatterns: true,
			exists: true
		});

		return this._searchService.fileSearch(query, token).then(
			result => {
				return result.limitHit;
			},
			err => {
				if (!isPromiseCanceledError(err)) {
					return Promise.reject(err);
				}

				return undefined;
			});
	}

	// --- save & edit resources ---

	$saveAll(includeUntitled?: boolean): Promise<boolean> {
		return this._textFileService.saveAll(includeUntitled).then(result => {
			return result.results.every(each => each.success === true);
		});
	}

	$resolveProxy(url: string): Promise<string | undefined> {
		return this._requestService.resolveProxy(url);
	}
}

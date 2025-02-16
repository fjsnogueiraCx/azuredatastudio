/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { URI, UriComponents } from 'vs/base/common/uri';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { ExtHostContext, ExtHostWindowShape, IExtHostContext, IOpenUriOptions, MainContext, MainThreadWindowShape } from '../common/extHost.protocol';
import { IHostService } from 'vs/workbench/services/host/browser/host';

@extHostNamedCustomer(MainContext.MainThreadWindow)
export class MainThreadWindow implements MainThreadWindowShape {

	private readonly proxy: ExtHostWindowShape;
	private readonly disposables = new DisposableStore();
	private readonly resolved = new Map<number, IDisposable>();

	constructor(
		extHostContext: IExtHostContext,
		@IHostService private readonly hostService: IHostService,
		@IOpenerService private readonly openerService: IOpenerService,
	) {
		this.proxy = extHostContext.getProxy(ExtHostContext.ExtHostWindow);

		Event.latch(hostService.onDidChangeFocus)
			(this.proxy.$onDidChangeWindowFocus, this.proxy, this.disposables);
	}

	dispose(): void {
		this.disposables.dispose();

		for (const value of this.resolved.values()) {
			value.dispose();
		}
		this.resolved.clear();
	}

	$getWindowVisibility(): Promise<boolean> {
		return Promise.resolve(this.hostService.hasFocus);
	}

	async $openUri(uriComponents: UriComponents, options: IOpenUriOptions): Promise<boolean> {
		const uri = URI.from(uriComponents);
		return this.openerService.open(uri, { openExternal: true, allowTunneling: options.allowTunneling });
	}

	async $resolveExternalUri(uriComponents: UriComponents, options: IOpenUriOptions): Promise<UriComponents> {
		const uri = URI.revive(uriComponents);
		const result = await this.openerService.resolveExternalUri(uri, options);
		return result.resolved;
	}
}

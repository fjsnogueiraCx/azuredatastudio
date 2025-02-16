/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IHostService } from 'vs/workbench/services/host/browser/host';

export class EnablePreviewFeatures implements IWorkbenchContribution {

	private static ENABLE_PREVIEW_FEATURES_SHOWN = 'workbench.enablePreviewFeaturesShown';

	constructor(
		@IStorageService storageService: IStorageService,
		@INotificationService notificationService: INotificationService,
		@IHostService hostService: IHostService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		let previewFeaturesEnabled = configurationService.getValue('workbench')['enablePreviewFeatures'];
		if (previewFeaturesEnabled || storageService.get(EnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN, StorageScope.GLOBAL)) {
			return;
		}
		Promise.all([
			hostService.hasFocus,
			hostService.windowCount
		]).then(([focused, count]) => {
			if (!focused && count > 1) {
				return null;
			}
			configurationService.updateValue('workbench.enablePreviewFeatures', false);

			const enablePreviewFeaturesNotice = localize('enablePreviewFeatures.notice', "Preview features are required in order for extensions to be fully supported and for some actions to be available.  Would you like to enable preview features?");
			notificationService.prompt(
				Severity.Info,
				enablePreviewFeaturesNotice,
				[{
					label: localize('enablePreviewFeatures.yes', "Yes"),
					run: () => {
						configurationService.updateValue('workbench.enablePreviewFeatures', true);
						storageService.store(EnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN, true, StorageScope.GLOBAL);
					}
				}, {
					label: localize('enablePreviewFeatures.no', "No"),
					run: () => {
						configurationService.updateValue('workbench.enablePreviewFeatures', false);
					}
				}, {
					label: localize('enablePreviewFeatures.never', "No, don't show again"),
					run: () => {
						configurationService.updateValue('workbench.enablePreviewFeatures', false);
						storageService.store(EnablePreviewFeatures.ENABLE_PREVIEW_FEATURES_SHOWN, true, StorageScope.GLOBAL);
					},
					isSecondary: true
				}]
			);
		})
			.then(null, onUnexpectedError);
	}
}

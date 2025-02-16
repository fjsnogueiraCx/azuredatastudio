/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ISharedProcess } from 'vs/platform/windows/electron-main/windows';

export const ISharedProcessMainService = createDecorator<ISharedProcessMainService>('sharedProcessMainService');

export interface ISharedProcessMainService {

	_serviceBrand: undefined;

	whenSharedProcessReady(): Promise<void>;
	toggleSharedProcessWindow(): Promise<void>;
}
export class SharedProcessMainService implements ISharedProcessMainService {

	_serviceBrand: undefined;

	constructor(private sharedProcess: ISharedProcess) { }

	whenSharedProcessReady(): Promise<void> {
		return this.sharedProcess.whenReady();
	}

	async toggleSharedProcessWindow(): Promise<void> {
		return this.sharedProcess.toggle();
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICredentialsService } from 'vs/workbench/services/credentials/common/credentials';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';

export interface ICredentialsProvider {
	getPassword(service: string, account: string): Promise<string | null>;
	setPassword(service: string, account: string, password: string): Promise<void>;

	deletePassword(service: string, account: string): Promise<boolean>;

	findPassword(service: string): Promise<string | null>;
	findCredentials(service: string): Promise<Array<{ account: string, password: string }>>;
}

export class BrowserCredentialsService implements ICredentialsService {

	_serviceBrand: undefined;

	private credentialsProvider: ICredentialsProvider;

	constructor(@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService) {
		if (environmentService.options && environmentService.options.credentialsProvider) {
			this.credentialsProvider = environmentService.options.credentialsProvider;
		} else {
			this.credentialsProvider = new InMemoryCredentialsProvider();
		}
	}

	getPassword(service: string, account: string): Promise<string | null> {
		return this.credentialsProvider.getPassword(service, account);
	}

	setPassword(service: string, account: string, password: string): Promise<void> {
		return this.credentialsProvider.setPassword(service, account, password);
	}

	deletePassword(service: string, account: string): Promise<boolean> {
		return this.credentialsProvider.deletePassword(service, account);
	}

	findPassword(service: string): Promise<string | null> {
		return this.credentialsProvider.findPassword(service);
	}

	findCredentials(service: string): Promise<Array<{ account: string, password: string }>> {
		return this.credentialsProvider.findCredentials(service);
	}
}

interface ICredential {
	service: string;
	account: string;
	password: string;
}

class InMemoryCredentialsProvider implements ICredentialsProvider {

	private credentials: ICredential[] = [];

	async getPassword(service: string, account: string): Promise<string | null> {
		const credential = this.doFindPassword(service, account);

		return credential ? credential.password : null;
	}

	async setPassword(service: string, account: string, password: string): Promise<void> {
		this.deletePassword(service, account);
		this.credentials.push({ service, account, password });
	}

	async deletePassword(service: string, account: string): Promise<boolean> {
		const credential = this.doFindPassword(service, account);
		if (credential) {
			this.credentials = this.credentials.splice(this.credentials.indexOf(credential), 1);
		}

		return !!credential;
	}

	async findPassword(service: string): Promise<string | null> {
		const credential = this.doFindPassword(service);

		return credential ? credential.password : null;
	}

	private doFindPassword(service: string, account?: string): ICredential | null {
		for (const credential of this.credentials) {
			if (credential.service === service && (typeof account !== 'string' || credential.account === account)) {
				return credential;
			}
		}

		return null;
	}

	async findCredentials(service: string): Promise<Array<{ account: string, password: string }>> {
		return this.credentials
			.filter(credential => credential.service === service)
			.map(({ account, password }) => ({ account, password }));
	}
}

registerSingleton(ICredentialsService, BrowserCredentialsService, true);

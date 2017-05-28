// @flow

import moment from 'moment-timezone';

export type TokenResponseGroupType = {
	href: string,
	name: string,
	status: string
}

export type TokenResponseAccountType = {
	href: string,
	status: string,
	email: string,
	givenName: string,
	surname: string,
	scopes: Array<TokenResponseGroupType>
}

export type TokenResponseType = {
	accessToken: string,
	refreshToken?: string,
	tokenType: string,
	expiresIn: number,
	scope: string,
	account?: TokenResponseAccountType
}

export type ApplicationOptionsType = {
	id?: string,
	signingKey?: string,
	accessTokenTTLInSeconds?: number,
	refreshTokenTTLInSeconds?: number,
	status?: string,
	created?: moment
}

export type DirectoryOptionsType = {
	id?: string,
	isDefault?: boolean,
	status?: string,
	created?: moment
}

export type OrganizationOptionsType = {
	id?: string,
	status?: string,
	created?: moment
}

export type GroupOptionsType = {
	id?: string,
	status?: string,
	created?: moment
}

export type AccountOptionsType = {
	id?: string,
	password?: string,
	userName?: ?string,
	middleName?: ?string,
	address1?: ?string,
	address2?: ?string,
	city?: ?string,
	state?: ?string,
	postalCode?: ?string,
	country?: ?string,
	phone?: ?string,
	timezone?: ?string,
	status?: string,
	created?: moment
}

export type ApiKeyOptionsType = {
	id?: string,
	pub?: string,
	pri?: string,
	created?: moment
}

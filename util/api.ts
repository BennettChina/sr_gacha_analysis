import axios, { AxiosError } from "axios";
import { generateDS, getGameBiz } from "#/sr_gacha_analysis/util/util";
import { AuthKey, GachaPoolInfo, UIGF_Md5 } from "#/sr_gacha_analysis/util/types";
import bot from "ROOT";
import { DB_KEY_GACHA_POOL_INFO } from "#/sr_gacha_analysis/util/constants";
import { guid } from "#/sr_gacha_analysis/util/guid";

const API = {
	AUTH_KEY: "https://api-takumi.mihoyo.com/binding/api/genAuthKey",
	TOKEN: "https://api-takumi.mihoyo.com/auth/api/getMultiTokenByLoginTicket",
	POOL: "https://webstatic.mihoyo.com/hk4e/gacha_info/cn_gf01/gacha/list.json",
	UIGF_MD5: "https://api.uigf.org/md5/starrail",
	UIGF_DICT: "https://api.uigf.org/dict/starrail/{lang}.json"
}

const HEADERS = {
	"cookie": "",
	"ds": "",
	"host": "api-takumi.mihoyo.com",
	"referer": "https://app.mihoyo.com",
	"user-agent": "okhttp/4.8.0",
	"x-rpc-app_version": "2.28.1",
	"x-rpc-channel": "mihoyo",
	"x-rpc-client_type": "2",
	"x-rpc-device_id": guid(),
	"x-rpc-device_model": "SM-977N",
	"x-rpc-device_name": "Samsung SM-G977N",
	"x-rpc-sys_version": "12",
};

export async function generateAuthKey( uid: string, server: string, cookie: string ): Promise<AuthKey> {
	return new Promise( ( resolve, reject ) => {
		const data = {
			auth_appid: "webview_gacha",
			game_biz: getGameBiz( uid[0] ),
			game_uid: uid,
			region: server
		};
		axios.post( API.AUTH_KEY, data, {
			headers: {
				...HEADERS,
				"ds": generateDS(),
				"cookie": cookie
			},
			timeout: 5000
		} ).then( ( { data: { retcode, message, data } } ) => {
			if ( retcode === 10001 ) {
				reject( "请更换Cookie" );
				return;
			}
			if ( retcode !== 0 ) {
				reject( "米游社接口报错: " + message );
				return;
			}
			resolve( data );
		} ).catch( reason => {
			if ( axios.isAxiosError( reason ) ) {
				let err = <AxiosError>reason;
				reject( `生成authKey失败, reason: ${ err.message }` )
			} else {
				reject( reason );
			}
		} )
	} )
}

export async function getSToken( userId: number, loginTicket: string, cookie: string ): Promise<any> {
	const params = {
		login_ticket: loginTicket,
		token_types: "3",
		uid: userId
	};
	return new Promise( ( resolve, reject ) => {
		axios.get( API.TOKEN, {
			headers: {
				...HEADERS,
				"origin": "https://webstatic.mihoyo.com",
				"referer": "https://webstatic.mihoyo.com/",
				"user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) miHoYoBBS/2.28.1",
				"x-requested-with": "com.mihoyo.hyperion",
				"ds": generateDS(),
				"cookie": cookie
			},
			params,
			timeout: 5000
		} ).then( ( { data: { retcode, message, data } } ) => {
			if ( retcode === 10001 ) {
				reject( "请更换Cookie" );
				return;
			}
			if ( retcode !== 0 ) {
				reject( "米游社接口报错: " + message );
				return;
			}
			resolve( data );
		} ).catch( reason => {
			if ( axios.isAxiosError( reason ) ) {
				let err = <AxiosError>reason;
				reject( `获取sToken失败, reason: ${ err.message }` );
			} else {
				reject( reason );
			}
		} )
	} )
}

export async function updatePoolId(): Promise<GachaPoolInfo> {
	const gacha_pool_info: string = await bot.redis.getString( DB_KEY_GACHA_POOL_INFO );
	if ( gacha_pool_info ) {
		return Promise.resolve( JSON.parse( gacha_pool_info ) );
	}
	
	return new Promise( ( resolve, reject ) => {
		axios.get( API.POOL, { timeout: 5000 } ).then( ( { data: { retcode, message, data } } ) => {
			if ( retcode !== 0 ) {
				reject( "米游社接口报错: " + message );
				return;
			}
			bot.redis.setString( DB_KEY_GACHA_POOL_INFO, JSON.stringify( data.list[0] ), 60 * 60 * 24 * 30 );
			resolve( data.list[0] );
		} ).catch( reason => {
			if ( axios.isAxiosError( reason ) ) {
				let err = <AxiosError>reason;
				reject( `更新卡池 ID 失败, reason: ${ err.message }` )
			} else {
				reject( reason );
			}
		} )
	} )
}

export async function getMd5(): Promise<UIGF_Md5> {
	const response: Response = await fetch( API.UIGF_MD5 );
	return await response.json();
}

export async function getDict( lang: string = "chs" ): Promise<Record<string, number>> {
	const response: Response = await fetch( API.UIGF_DICT.replace( "{lang}", lang ) );
	return await response.json();
}
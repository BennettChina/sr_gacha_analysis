import { Md5 } from "md5-typescript";
import {
	AuthKey,
	FakeIdFunc,
	Gacha_Info,
	GachaUrl,
	GachaUserInfo,
	QiniuOssConfig,
	Standard_Gacha_Data
} from "#/sr_gacha_analysis/util/types";
import Database from "@/modules/database";
import { exec } from "child_process";
import FileManagement from "@/modules/file";
import { generateAuthKey, getSToken } from "#/sr_gacha_analysis/util/api";
import fetch from "node-fetch";
import bot from "ROOT";
import { createReadStream } from "fs";
import { RenderResult } from "@/modules/renderer";
import { renderer } from "#/sr_gacha_analysis/init";
import { InputParameter } from "@/modules/command";
import { DB_KEY_CURRENT_ID, DB_KEY_GACHA_DATA, DB_KEY_GACHA_URL } from "#/sr_gacha_analysis/util/constants";
import { Viewport } from "puppeteer";
import { getRandomString } from "@/utils/random";

export async function sleep( ms: number ): Promise<void> {
	return new Promise( resolve => setTimeout( resolve, ms ) );
}

function parseID( msg: string ): number {
	if ( !msg ) {
		return 1;
	}
	const id: number = parseInt( msg );
	if ( !Number.isNaN( id ) ) {
		return id;
	}
	
	const res: string[] | null = msg.match( /(\d+)/g );
	if ( res ) {
		const list: string[] = res.sort( ( x, y ) => x.length - y.length );
		return parseInt( list[0] );
	} else {
		return 1;
	}
}

export function generateDS(): string {
	// 2.40.1
	//fdv0fY9My9eA7MR0NpjGP9RjueFvjUSQ
	const n: string = "dWCcD2FsOUXEstC5f9xubswZxEeoBOTc";
	const i: number = Date.now() / 1000 | 0;
	const r: string = getRandomString( 6 ).toLowerCase();
	const c: string = Md5.init( `salt=${ n }&t=${ i }&r=${ r }` );
	
	return `${ i },${ r },${ c }`;
}

export function getRegion( first ) {
	switch ( first ) {
		case "1":
		case "2":
			// 官服
			return "prod_gf_cn";
		case "5":
			// 渠道服
			return "prod_gf_qd";
		case "6":
			// 美服
			return "prod_official_usa";
		case "7":
			// 欧服
			return "prod_official_euro";
		case "8":
			// 亚服
			return "prod_official_asia";
		case "9":
			// 港澳台服
			return "prod_official_cht";
		default:
			return "prod_gf_cn";
	}
}

export function getGameBiz( first: string ): string {
	switch ( first ) {
		case "1":
			return "hkrpg_cn";
		case "2":
			return "hkrpg_cn";
		case "5":
			return "hkrpg_cn";
		default:
			return "hkrpg_global";
	}
}

export function obj2ParamsStr( obj: object ): string {
	const params: string[] = [];
	for ( let key in obj ) {
		params.push( `${ key }=${ obj[key] }` );
	}
	return params.join( '&' );
}

export function cookie2Obj( cookie: string ): any {
	return decodeURIComponent( cookie ).split( ";" )
		.filter( item => !!item && item.trim().length > 0 )
		.map( item => item.split( '=' ) )
		.reduce( ( acc, [ k, v ] ) => ( acc[k.trim().replace( '"', '' )] = v ) && acc, {} );
}

export const fakeIdFn: () => FakeIdFunc = () => {
	let id = 1000000000000000000n;
	return () => {
		id = id + 1n
		return id.toString( 10 );
	}
}

const header_zh_cn = {
	time: '时间',
	name: '名称',
	item_type: '类别',
	rank_type: '星级',
	gacha_type: '祈愿类型'
}

export const gacha_types_zh_cn = {
	"11": "角色活动跃迁",
	"12": "光锥活动跃迁",
	"1": "群星跃迁",
	"2": "始发跃迁"
};
const gacha_types_en_us = {
	"11": "Character Event Warp",
	"12": "Light Cone Event Warp",
	"1": "Stellar Warp",
	"2": "Departure Warp"
};

export const sheet_names_zh_cn = { "11": "角色活动跃迁", "12": "光锥活动跃迁", "1": "群星跃迁", "2": "始发跃迁" };
const sheet_names_en_us = {
	"11": "Character Event Warp",
	"12": "Light Cone Event Warp",
	"1": "Stellar Warp",
	"2": "Departure Warp"
};

export function convert2Lang( key: string, lang: string ): string {
	return lang === 'zh-cn' ? header_zh_cn[key] : key;
}

export function convert2Readable( gacha_type: string, lang: string ): string {
	return lang === 'zh-cn' ? gacha_types_zh_cn[gacha_type] : gacha_types_en_us[gacha_type];
}

const rank_color = {
	"3": "ff8e8e8e",
	"4": "ffa256e1",
	"5": "ffbd6932",
}

export function getColor( rank_type: string ): string {
	return rank_color[rank_type];
}

export async function upload2Qiniu( file_path: string, file_name: string, qiniu_config: QiniuOssConfig, redis: Database ): Promise<string> {
	if ( !qiniu_config.enable && qiniu_config.uses3 ) {
		const { S3Client, PutObjectCommand } = require( "@aws-sdk/client-s3" );
		// Create an Amazon S3 service client object.
		const s3Client = new S3Client( {
			region: qiniu_config.s3region, endpoint: `https://${ qiniu_config.s3endpoint }`,
			credentials: {
				accessKeyId: qiniu_config.accessKey,
				secretAccessKey: qiniu_config.secretKey
			}
		} );
		
		// Set the parameters
		const params = {
			Bucket: qiniu_config.bucket,
			Key: `${ qiniu_config.folder }/${ file_name }`,
			Body: createReadStream( file_path )
		};
		
		// Create an object and upload it to the Amazon S3 bucket.
		return new Promise( ( resolve, reject ) => {
			s3Client.send( new PutObjectCommand( params ) ).then( () => {
				resolve( `${ qiniu_config.domain }${ params.Key }?attname=${ file_name }` );
			} ).catch( reason => {
				reject( reason );
			} );
		} )
	}
	
	const {
		form_up: { FormUploader },
		auth: { digest },
		rs: { PutPolicy }
	} = require( "qiniu" );
	
	// 获取上传凭证
	let upload_token: string = await redis.getString( "genshin_gacha.oss.upload_token" );
	if ( !upload_token ) {
		const mac = new digest.Mac( qiniu_config.accessKey, qiniu_config.secretKey );
		const options = {
			scope: qiniu_config.bucket
		};
		const putPolicy = new PutPolicy( options );
		upload_token = putPolicy.uploadToken( mac );
		await redis.setString( "genshin_gacha.oss.upload_token", upload_token, 3600 );
	}
	
	// 开始上传
	const formUploader = new FormUploader();
	return new Promise( ( resolve, reject ) => {
		formUploader.putFile( upload_token, `${ qiniu_config.folder }/${ file_name }`, file_path, null, ( respErr, respBody, respInfo ) => {
			if ( respErr ) {
				reject( respErr );
				return;
			}
			
			if ( respInfo.statusCode !== 200 ) {
				reject( respBody );
				return;
			}
			
			const { key } = respBody;
			resolve( `${ qiniu_config.domain }${ key }?attname=${ file_name }` );
		} );
	} );
}

/* 命令执行 */
export async function execHandle( command: string ): Promise<string> {
	return new Promise( ( resolve, reject ) => {
		exec( command, ( error, stdout, stderr ) => {
			if ( error ) {
				reject( error );
			} else {
				resolve( stdout );
			}
		} )
	} )
}

export function checkDependencies( file: FileManagement, ...dependencies ): string[] {
	const path: string = file.getFilePath( "package.json", "root" );
	const { dependencies: dep } = require( path );
	// 过滤出未安装的依赖
	const keys: string[] = Object.keys( dep );
	return dependencies.filter( dependency => !keys.includes( dependency ) );
}

async function generatorUrl( cookie: string, game_uid: string, mysID: number, server: string ): Promise<GachaUrl> {
	let url: string;
	let flag: boolean = false;
	// 如果已有 stoken 就不需要再去请求新的，可以解决 login_ticket 经常过期的问题
	if ( !cookie.includes( "stoken" ) ) {
		const { login_ticket } = cookie2Obj( cookie );
		if ( !login_ticket ) {
			throw "cookie缺少login_ticket无法生成URL";
		}
		if ( !cookie.includes( "stuid" ) ) {
			cookie = cookie + ";stuid=" + mysID;
		}
		if ( !cookie.includes( "login_uid" ) ) {
			cookie = cookie + ";login_uid=" + mysID;
		}
		const { list } = await getSToken( mysID, login_ticket, cookie );
		const sToken: string = list[0].token;
		cookie = cookie + ";stoken=" + sToken;
		flag = true;
	}
	const { authkey, authkey_ver, sign_type }: AuthKey = await generateAuthKey( game_uid, server, cookie );
	// const { gacha_id, gacha_type }: GachaPoolInfo = await updatePoolId();
	const game_biz: string = getGameBiz( game_uid[0] );
	const params = {
		"authkey_ver": authkey_ver || "1",
		"sign_type": sign_type || "2",
		"auth_appid": "webview_gacha",
		"win_mode": "fullscreen",
		"gacha_id": `dbebc8d9fbb0d4ffa067423482ce505bc5ea`,
		"timestamp": ( Date.now() / 1000 | 0 ).toString( 10 ),
		"region": getRegion( game_uid[0] ),
		"default_gacha_type": `11`,
		"lang": "zh-cn",
		"authkey": encodeURIComponent( authkey ),
		"game_biz": game_biz,
		"os_system": "Android%20OS%2012%20%2F%20API-31%20%28SKQ1.211006.001%2FV13.0.13.0.SKACNXM%29",
		"device_model": "Xiaomi%20K2902N1AT",
		"plat_type": "android",
		"gacha_type": "11",
		"page": 1,
		"size": 5,
		"end_id": 0,
	}
	let log_html_url: string;
	if ( game_biz === 'hkrpg_cn' ) {
		log_html_url = "https://webstatic.mihoyo.com/hkrpg/event/e20211215gacha-v2/index.html?";
		url = "https://api-takumi.mihoyo.com/common/gacha_record/api/getGachaLog?";
	} else {
		throw "暂不支持国际服生成链接";
	}
	const paramsStr = obj2ParamsStr( params );
	url += paramsStr;
	log_html_url = log_html_url + paramsStr + "#/log";
	
	// 校验URL
	let response = await fetch( url, { method: "GET" } );
	let data = await response.json();
	if ( data.retcode === 0 ) {
		return {
			api_log_url: url,
			log_html_url,
			cookie: flag ? cookie : undefined
		}
	} else {
		throw `抽卡链接生成失败: ${ data.message }`;
	}
}

export async function getTimeOut( key: string ): Promise<number> {
	return await bot.redis.client.ttl( key );
}

export function secondToString( ttl: number ): string {
	const hour = Math.floor( ttl / 3600 );
	const minute = Math.floor( ( ttl - hour * 3600 ) / 60 );
	const second = ttl % 60;
	return `${ hour } 时 ${ minute } 分 ${ second } 秒`;
}

export async function analysisHandler( style: string, user_id: number, { sendMessage }: InputParameter ) {
	const viewport: Viewport = {
		width: 2000,
		height: 1000,
		deviceScaleFactor: 2
	}
	const res: RenderResult = await renderer.asSegment( "/analysis.html", { qq: user_id }, viewport );
	if ( res.code === "ok" ) {
		await sendMessage( res.data );
	} else {
		bot.logger.error( res.error );
		await sendMessage( "图片渲染异常，请联系持有者进行反馈" );
	}
}

export async function getUrl( sn: string, {
	messageData: { sender: { user_id } },
	redis,
	auth,
	logger
}: InputParameter ): Promise<string> {
	const key: string = DB_KEY_GACHA_URL.replace( "$qq", user_id.toString() ).replace( "$sn", sn || "0" );
	// const html_key: string = DB_KEY_GACHA_HTML_URL.replace( "$qq", user_id.toString() ).replace( "$sn", sn || "0" );
	const url: string = await redis.getString( key );
	if ( url ) {
		return url;
	}
	return "";
	
	// let info: Private | string | undefined;
	// // 从私人服务获取Cookie
	// info = await getPrivateAccount( user_id, sn, auth );
	// if ( typeof info === "string" ) {
	// 	throw info;
	// }
	//
	// try {
	// 	logger.debug( `UID: {${ info.setting.uid }, Cookie: ${ info.setting.stoken }` );
	// 	const {
	// 		api_log_url,
	// 		log_html_url,
	// 		cookie
	// 	}: GachaUrl = await generatorUrl( info.setting.stoken, info.setting.uid, info.setting.mysID, info.setting.server );
	// 	// 更新Cookie
	// 	if ( cookie ) {
	// 		await info.replaceCookie( cookie );
	// 	}
	// 	// 校验成功放入缓存，不需要频繁生成URL
	// 	await redis.setString( key, api_log_url, DB_EXPIRE_24H );
	// 	await redis.setString( html_key, log_html_url, DB_EXPIRE_24H );
	// 	return api_log_url;
	// } catch ( error ) {
	// 	throw error;
	// }
	
}

async function getData( url: string, retryTimes: number = 0 ): Promise<any> {
	let response = await fetch( url, { method: "GET" } );
	const data = await response.json();
	if ( data.retcode === -110 ) {
		if ( retryTimes > 5 ) {
			throw "访问频繁，重试次数达限。";
		}
		await sleep( 5000 );
		return await getData( url, retryTimes + 1 );
	}
	if ( data.retcode === -101 ) {
		throw "AuthKey 已过期，缓存链接已删除，请重试!";
	}
	if ( data.retcode !== 0 ) {
		throw data.message ? data.message : "抽卡记录拉取失败，请检查URL！";
	}
	
	return data;
}

export async function loadData( url: string, user_id, sn, { redis, logger }: InputParameter ): Promise<void> {
	let codes = { 'lt': '<', 'gt': '>', 'nbsp': ' ', 'amp': '&', 'quot': '"' };
	url = url.replace( /&(lt|gt|nbsp|amp|quot);/ig, ( _all, t ) => codes[t] );
	const keys = Object.keys( gacha_types_zh_cn );
	const urlObj = new URL( url );
	let page = 1;
	const size = 20;
	const default_region: string = "prod_gf_cn";
	const default_region_time_zone: number = 8;
	
	const info: GachaUserInfo = {
		uid: "",
		region: default_region,
		region_time_zone: default_region_time_zone
	};
	for ( let gacha_type of keys ) {
		let gacha_id = '0';
		let length = size;
		label_type:
			do {
				const params = urlObj.searchParams;
				params.set( "page", `${ page }` );
				params.set( "size", `${ size }` );
				params.set( "end_id", gacha_id );
				params.set( "gacha_type", gacha_type );
				if ( !params.has( "game_biz" ) ) {
					params.set( "game_biz", "hkrpg_cn" );
				}
				url = urlObj.toString().replace( /\+/g, "%2B" );
				let data = await getData( url );
				length = data.data.list.length;
				info.region = data.data.region || default_region;
				info.region_time_zone = data.data.region_time_zone || default_region_time_zone;
				for ( let element of data.data.list ) {
					gacha_id = element.id;
					info.uid = element.uid;
					const db_key: string = DB_KEY_GACHA_DATA.replace( "$gacha_type", gacha_type ).replace( "$uid", info.uid );
					let hasKey = await redis.existHashKey( db_key, gacha_id );
					if ( hasKey ) {
						page++;
						await sleep( 200 );
						break label_type;
					}
					await redis.setHash( db_key, { [gacha_id]: JSON.stringify( element ) } );
				}
				page++;
				await sleep( 200 );
			} while ( length === size );
	}
	
	logger.debug( "CURRENT UID: ", info );
	if ( info.uid ) {
		const db_key = DB_KEY_CURRENT_ID.replace( "$qq", user_id );
		await redis.setHash( db_key, { ...info } );
	}
}

/**
 * 按照升序排列，优先比较时间，时间相同则比较ID。
 * @param prev
 * @param curr
 * @return 0,1,-1
 */
export function sortRecords( prev: Gacha_Info | Standard_Gacha_Data, curr: Gacha_Info | Standard_Gacha_Data ): number {
	const prev_time = new Date( prev.time ).getTime();
	const curr_time = new Date( curr.time ).getTime();
	if ( prev_time > curr_time ) {
		return 1;
	} else if ( prev_time === curr_time ) {
		return prev.id!.localeCompare( curr.id! );
	} else {
		return -1;
	}
}

export function htmlDecode( str: string ): string {
	str = str.replace( /&#(\d+);/gi, function ( match, numStr ) {
		const num = parseInt( numStr, 10 );
		return String.fromCharCode( num );
	} );
	return str.replace( /&amp;/gi, "&" );
}
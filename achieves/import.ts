import { InputParameter } from "@modules/command";
import fetch from "node-fetch";
import { Gacha_Info, GachaUserInfo, Standard_Gacha } from "#sr_gacha_analysis/util/types";
import { fakeIdFn, getRegion } from "#sr_gacha_analysis/util/util";
import { isPrivateMessage } from "@modules/message";
import { Group, GroupMessage, MessageElem, PrivateMessage, User } from "icqq";
import { DB_KEY_CURRENT_ID, DB_KEY_GACHA_DATA } from "#sr_gacha_analysis/util/constants";

async function import_from_json( file_url, {
	redis,
	sendMessage,
	messageData: { sender: { user_id } }
}: InputParameter ): Promise<void> {
	const response: Response = await fetch( file_url );
	const { info, list }: Standard_Gacha = await response.json();
	if ( list ) {
		const func = fakeIdFn();
		for ( let data of list ) {
			const gacha_id: string = data.id || func();
			const gacha_info: Gacha_Info = {
				...data,
				id: gacha_id,
				lang: info.lang,
				uid: info.uid
			}
			const db_key: string = DB_KEY_GACHA_DATA.replace( "$gacha_type", data.gacha_type ).replace( "$uid", info.uid );
			await redis.setHash( db_key, { [gacha_id]: JSON.stringify( gacha_info ) } );
		}
		const db_key = DB_KEY_CURRENT_ID.replace( "$qq", user_id.toString() );
		const uid: string = await redis.getHashField( db_key, "uid" );
		if ( !uid ) {
			const data: GachaUserInfo = {
				uid: info.uid,
				region_time_zone: info.region_time_zone,
				region: getRegion( info.uid[0] )
			};
			await redis.setHash( db_key, data );
		}
		await sendMessage( `${ info.uid } 的 ${ list.length } 条抽卡记录数据已导入。` );
	}
}

async function import_from_excel( file_url: string, {
	redis,
	sendMessage,
	messageData: { sender: { user_id } }
}: InputParameter ): Promise<void> {
	const response: Response = await fetch( file_url );
	const buffer: ArrayBuffer = await response.arrayBuffer();
	const ExcelJS = require( 'exceljs' );
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load( buffer );
	const worksheet = workbook.getWorksheet( "原始数据" );
	if ( !worksheet ) {
		await sendMessage( "没有在Excel中发现[原始数据]表，无法导入你的数据。" );
		return;
	}
	const sheetValues: any[] = worksheet.getSheetValues();
	const headers: string[] = sheetValues[1];
	const func = fakeIdFn();
	let import_uid: string = "";
	sheetValues.filter( ( v, i ) => i > 1 ).forEach( value => {
		const gacha_info: object = {};
		headers.forEach( ( key, idx ) => {
			if ( key === 'id' && !value[idx] ) {
				gacha_info[key] = func();
			}
			gacha_info[key] = value[idx];
		} )
		// @ts-ignore
		const { gacha_type, uid, id } = gacha_info;
		import_uid = uid;
		const db_key: string = DB_KEY_GACHA_DATA.replace( "$gacha_type", gacha_type ).replace( "$uid", uid );
		redis.setHash( db_key, { [id]: JSON.stringify( gacha_info ) } );
	} );
	
	const db_key = DB_KEY_CURRENT_ID.replace( "$qq", user_id.toString() );
	const uid: string = await redis.getHashField( db_key, "uid" );
	if ( !uid ) {
		const data: GachaUserInfo = {
			uid: import_uid,
			region_time_zone: 8,
			region: getRegion( import_uid[0] )
		};
		await redis.setHash( db_key, data );
	}
	
	await sendMessage( `${ import_uid } 的 ${ sheetValues.length } 条抽卡记录数据已导入。` );
}

export async function main( bot: InputParameter ): Promise<void> {
	const { sendMessage, messageData, client, logger } = bot;
	const { raw_message, source } = messageData;
	const reg = new RegExp( /(?<import_type>json|excel)\s*(?<url>https?:\/\/(?:www\.)?[-a-zA-Z\d@:%._+~#=]{1,256}\.[a-zA-Z\d()]{1,6}\b[-a-zA-Z\d()!@:%_+.~#?&/=]*)?/ );
	const exec: RegExpExecArray | null = reg.exec( raw_message );
	const download_url: string = ( exec?.groups?.url || "" ).trim();
	const import_type: string | undefined = exec?.groups?.import_type;
	if ( download_url ) {
		try {
			if ( import_type === 'json' ) {
				await import_from_json( download_url, bot );
			} else {
				// excel
				await import_from_excel( download_url, bot );
			}
		} catch ( error ) {
			logger.error( '数据导入出错', error );
			await sendMessage( `数据导入出错! ${ <string>error }` );
		}
		return;
	}
	
	if ( !source ) {
		await sendMessage( "请回复你上传文件的那条消息的同时使用该指令。" )
		return;
	}
	
	let url: string;
	const unit: Group | User = isPrivateMessage( messageData ) ? client.pickUser( source.user_id ) : client.pickGroup( messageData.group_id );
	const time: number = isPrivateMessage( messageData ) ? source.time + 100 : source.seq;
	const cnt: number = isPrivateMessage( messageData ) ? 20 : 1;
	let chatHistory: PrivateMessage[] | GroupMessage[] = await unit.getChatHistory( time, cnt );
	if ( chatHistory.length === 0 ) {
		await sendMessage( "未获取到要导入的文件，或可尝试使用文件链接导入。" );
		return;
	}
	if ( isPrivateMessage( messageData ) ) {
		// 私聊要根据seq过滤，这样才能精确拿到引用消息中的文件。
		chatHistory = ( <PrivateMessage[]>chatHistory ).filter( m => m.seq === source.seq );
	}
	const replyMessage: MessageElem = chatHistory[0].message[0];
	if ( replyMessage.type !== "file" ) {
		await sendMessage( "未获取到要导入的文件，或可尝试使用文件链接导入。" );
		return;
	}
	
	url = await unit.getFileUrl( replyMessage.fid );
	try {
		if ( raw_message === 'json' ) {
			await import_from_json( url, bot );
		} else {
			// excel
			await import_from_excel( url, bot );
		}
	} catch ( error ) {
		logger.error( '数据导入出错', error );
		await sendMessage( `数据导入出错! ${ <string>error }` );
	}
}
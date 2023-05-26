import { InputParameter, Order } from "@modules/command";
import {
	Gacha_Info,
	GachaUserInfo,
	Standard_Gacha,
	Standard_Gacha_Data,
	Standard_Gacha_Excel,
	Standard_Gacha_Excel_Origin_Data,
	Standard_Gacha_Info
} from "#sr_gacha_analysis/util/types";
import moment from "moment";
import fs from "fs";
import { resolve } from "path";
import { isGroupMessage } from "@modules/message";
import {
	convert2Lang,
	convert2Readable,
	gacha_types_zh_cn,
	getColor,
	getTimeOut,
	getUrl,
	secondToString,
	sheet_names_zh_cn,
	sortRecords,
	upload2Qiniu
} from "#sr_gacha_analysis/util/util";

import { getRandomStr } from "@modules/utils";
import { gacha_config } from "#sr_gacha_analysis/init";
import bot from "ROOT";
import { ImageElem, MessageRet, segment, Sendable } from "icqq";
import { Logger } from "log4js";
import FileManagement from "@modules/file";
import { DB_KEY_CURRENT_ID, DB_KEY_GACHA_DATA, DB_KEY_GACHA_HTML_URL } from "#sr_gacha_analysis/util/constants";

async function sendExportResult( url: string, logger: Logger, sendMessage: ( content: Sendable, allowAt?: boolean ) => Promise<MessageRet> ) {
	if ( gacha_config.qrcode ) {
		const { toDataURL } = require( "qrcode" );
		const options = {
			errorCorrectionLevel: 'H',
			margin: 1,
			color: {
				dark: '#000',
				light: '#FFF',
			}
		}
		toDataURL( url, options, ( err: any, image: string ) => {
			if ( err || !image ) {
				logger.error( "二维码生成失败", err );
				sendMessage( `抽卡记录文件已导出，可在浏览器访问 ${ url } 下载查看。` );
				return;
			}
			image = image.replace( "data:image/png;base64,", "" );
			const qr_code: ImageElem = segment.image( `base64://${ image }` );
			sendMessage( qr_code );
		} )
	} else {
		await sendMessage( `抽卡记录文件已导出，可在浏览器访问 ${ url } 下载查看。` );
	}
}

async function export2JSON( export_data: Standard_Gacha, i: InputParameter ) {
	const { file, sendMessage, messageData, redis, logger, auth } = i;
	const json = JSON.stringify( export_data );
	const file_name = `SRGF-${ export_data.info.uid }-${ moment( export_data.info.export_timestamp * 1000 ).format( "yyMMDDHHmmss" ) }.json`;
	const tmp_path = resolve( file.root, 'tmp' );
	if ( !fs.existsSync( tmp_path ) ) {
		fs.mkdirSync( tmp_path );
	}
	const export_json_path = resolve( tmp_path, file_name );
	const opened: number = fs.openSync( export_json_path, "w" );
	fs.writeSync( opened, json );
	fs.closeSync( opened );
	if ( gacha_config.qiniuOss.enable || gacha_config.qiniuOss.uses3 ) {
		try {
			// 上传到 OSS
			const url: string = await upload2Qiniu( export_json_path, file_name, gacha_config.qiniuOss, redis );
			// 导出后删掉临时文件
			fs.unlinkSync( export_json_path );
			await sendExportResult( url, logger, sendMessage );
			return;
		} catch ( error ) {
			logger.error( "抽卡记录导出成功，上传 OSS 失败！", error );
			const CALL = <Order>bot.command.getSingle( "adachi.call", await auth.get( messageData.user_id ) );
			const appendMsg = CALL ? `私聊使用 ${ CALL.getHeaders()[0] } ` : "";
			await sendMessage( `文件导出成功，上传云存储失败，请${ appendMsg }联系 BOT 持有者反馈该问题。` );
			// 删掉避免占用空间，有需求重新生成。
			fs.unlinkSync( export_json_path );
		}
	}
	await uploadFile( export_json_path, file_name, i );
}


async function addRowAndSetStyle( sheet, data: Standard_Gacha_Excel ) {
	const row = sheet.addRow( data );
	row.eachCell( { includeEmpty: true }, cell => {
		cell.alignment = {
			horizontal: 'center',
			vertical: 'middle'
		}
		cell.font = {
			color: { argb: getColor( data.rank_type ) },
			bold: data.rank_type === "5"
		}
		cell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'ffebebeb' }
		}
		cell.border = {
			top: { style: 'thin', color: { argb: 'ffc4c2bf' } },
			left: { style: 'thin', color: { argb: 'ffc4c2bf' } },
			bottom: { style: 'thin', color: { argb: 'ffc4c2bf' } },
			right: { style: 'thin', color: { argb: 'ffc4c2bf' } }
		}
	} );
	row.commit();
}

function setHeaderStyle( headers: string[], sheet ) {
	headers.forEach( ( value, index ) => {
		const cell = sheet.getCell( 1, index + 1 );
		cell.border = {
			top: { style: 'thin', color: { argb: 'ffc4c2bf' } },
			left: { style: 'thin', color: { argb: 'ffc4c2bf' } },
			bottom: { style: 'thin', color: { argb: 'ffc4c2bf' } },
			right: { style: 'thin', color: { argb: 'ffc4c2bf' } }
		}
		cell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'ffdbd7d3' },
		}
		cell.font = {
			color: { argb: "ff757575" },
			bold: true
		}
		cell.alignment = {
			horizontal: 'center',
			vertical: 'middle'
		}
	} );
}

async function uploadFile( file_path: string, file_name: string, {
	client,
	messageData,
	logger,
	sendMessage
}: InputParameter ) {
	if ( isGroupMessage( messageData ) ) {
		try {
			await client.pickGroup( messageData.group_id ).fs.upload( file_path, "/StarRail/gacha_export", file_name, percentage => {
				logger.debug( "抽卡记录文件上传进度: ", percentage );
			} );
			await sendMessage( `抽卡记录文件已导出至${ file_name }` );
		} catch ( e ) {
			logger.warn( `抽卡记录导出文件 ${ file_name } 上传群文件失败`, e );
			await sendMessage( "抽卡记录导出文件上传群文件失败，请重试！" );
		} finally {
			// 导出后删掉临时文件
			fs.unlinkSync( file_path );
		}
	} else {
		try {
			await client.pickFriend( messageData.from_id ).sendFile( file_path, file_name, percentage => {
				logger.debug( "抽卡记录文件上传进度: ", percentage );
			} );
			await sendMessage( `抽卡记录文件已导出至${ file_name }` );
		} catch ( e ) {
			logger.warn( `抽卡记录导出文件 ${ file_name } 上传文件失败`, e );
			await sendMessage( "抽卡记录导出文件上传文件失败，请重试！" );
		} finally {
			// 导出后删掉临时文件
			fs.unlinkSync( file_path );
		}
	}
}

async function export2Excel( {
	                             info: { uid, lang, export_timestamp },
	                             list
                             }: Standard_Gacha, i: InputParameter ) {
	const { file, messageData, sendMessage, redis, logger, auth } = i;
	const gacha_csv_objects: Standard_Gacha_Excel[] =
		list.map( ( { time, name, gacha_type, rank_type, item_type } ) => {
			return { time, name, item_type, rank_type, gacha_type };
		} );
	const ExcelJS = require( 'exceljs' );
	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'adachi-bot';
	workbook.lastModifiedBy = 'adachi-bot';
	workbook.created = new Date();
	workbook.modified = new Date();
	
	for ( let type in sheet_names_zh_cn ) {
		const sheet = workbook.addWorksheet( sheet_names_zh_cn[type], {
			views: [ {
				state: 'frozen',
				ySplit: 1,
				zoomScale: 260
			} ]
		} );
		let width = [ 24, 14, 8, 8, 20 ]
		if ( !lang.includes( 'zh-' ) ) {
			width = [ 24, 32, 16, 12, 24 ]
		}
		const headers = Object.keys( gacha_csv_objects[0] );
		sheet.columns = headers.map( ( key, index ) => {
			return {
				header: convert2Lang( key, lang ),
				key,
				width: width[index]
			}
		} );
		setHeaderStyle( headers, sheet );
		
		const filter_gacha_data = gacha_csv_objects.filter( value => value.gacha_type === type );
		for ( const data of filter_gacha_data ) {
			data.gacha_type = convert2Readable( data.gacha_type, lang );
			await addRowAndSetStyle( sheet, data );
		}
		
		// 设置保护模式，避免用户随意修改内容
		await sheet.protect( getRandomStr( 20 ), {
			formatCells: true,
			formatRows: true,
			formatColumns: true,
			sort: true,
			autoFilter: true,
			pivotTables: true
		} );
	}
	
	// 添加一个原始数据的表
	const sheet = workbook.addWorksheet( "原始数据", {
		views: [ {
			state: 'frozen',
			ySplit: 1,
			zoomScale: 260
		} ]
	} );
	// 1682507400025260178	艾丝妲	1009	角色	1001	1	4	1	2023-04-26 19:50:53	zh-cn	100341078
	let width = [ 24, 18, 12, 12, 12, 12, 12, 8, 24, 8, 16 ]
	if ( !lang.includes( 'zh-' ) ) {
		width = [ 24, 24, 12, 12, 12, 12, 12, 8, 24, 8, 16 ]
	}
	const origin_data_list: Standard_Gacha_Excel_Origin_Data[] = list.map( ( data: Standard_Gacha_Data ) => {
		return {
			...data,
			lang,
			uid
		}
	} );
	const headers = Object.keys( origin_data_list[0] );
	sheet.columns = headers.map( ( key, index ) => {
		return {
			header: key,
			key,
			width: width[index]
		}
	} );
	setHeaderStyle( headers, sheet );
	for ( const data of origin_data_list ) {
		await addRowAndSetStyle( sheet, data );
	}
	// 设置保护模式，避免用户随意修改内容
	await sheet.protect( getRandomStr( 20 ), {
		formatCells: true,
		formatRows: true,
		formatColumns: true,
		sort: true,
		autoFilter: true,
		pivotTables: true
	} );
	
	const file_name = `SRGF-${ uid }-${ moment( export_timestamp * 1000 ).format( "yyMMDDHHmmss" ) }.xlsx`;
	const tmp_path = resolve( file.root, 'tmp' );
	if ( !fs.existsSync( tmp_path ) ) {
		fs.mkdirSync( tmp_path );
	}
	const export_excel_path = resolve( tmp_path, file_name );
	await workbook.xlsx.writeFile( export_excel_path );
	
	if ( gacha_config.qiniuOss.enable || gacha_config.qiniuOss.uses3 ) {
		// 上传到 OSS
		try {
			const url: string = await upload2Qiniu( export_excel_path, file_name, gacha_config.qiniuOss, redis );
			// 导出后删掉临时文件
			fs.unlinkSync( export_excel_path );
			await sendExportResult( url, logger, sendMessage );
			return;
		} catch ( error ) {
			logger.error( "抽卡记录导出成功，上传 OSS 失败！", error );
			const CALL = <Order>bot.command.getSingle( "adachi.call", await auth.get( messageData.user_id ) );
			const appendMsg = CALL ? `私聊使用 ${ CALL.getHeaders()[0] } ` : "";
			await sendMessage( `文件导出成功，上传云存储失败，请${ appendMsg }联系 BOT 持有者反馈该问题。` );
			// 删掉避免占用空间，有需求重新生成。
			fs.unlinkSync( export_excel_path );
			return;
		}
	}
	await uploadFile( export_excel_path, file_name, i );
}

async function export_gacha_url( user_id: number, sn: string, i: InputParameter ) {
	const { redis, sendMessage, logger } = i;
	try {
		await getUrl( sn, i );
	} catch ( error ) {
		logger.error( '[星铁抽卡分析] 链接生成失败:', error );
		await sendMessage( `链接生成失败: ${ error }` );
		return;
	}
	const html_key: string = DB_KEY_GACHA_HTML_URL.replace( "$qq", user_id.toString() ).replace( "$sn", sn || "0" );
	let url: string = await redis.getString( html_key );
	if ( url ) {
		await sendMessage( url );
		const timeout: number = await getTimeOut( html_key );
		const human_time: string = secondToString( timeout );
		await sendMessage( `链接将在${ human_time }后过期。` );
		return;
	}
}

function getVersion( file: FileManagement ): string {
	const path: string = file.getFilePath( "package.json", "root" );
	const { version } = require( path );
	return version.split( "-" )[0];
}

export async function main( bot: InputParameter ): Promise<void> {
	const { sendMessage, messageData, redis } = bot;
	const { sender: { user_id }, raw_message } = messageData;
	const reg = new RegExp( /(?<type>json|excel|url)(\s)*(?<sn>\d+)?/ );
	const res: RegExpExecArray | null = reg.exec( raw_message );
	const type: string = res?.groups?.type || "";
	const sn: string = res?.groups?.sn || "";
	
	// 链接直接导出
	if ( type === 'url' ) {
		await export_gacha_url( user_id, sn, bot );
		return;
	}
	
	// 获取存储的抽卡记录数据
	const gacha_data_list: Standard_Gacha_Data[] = [];
	const {
		uid,
		region_time_zone
	}: GachaUserInfo = await redis.getHash( DB_KEY_CURRENT_ID.replace( "$qq", user_id.toString() ) );
	let lang: string = "zh-cn";
	for ( let gacha_type in gacha_types_zh_cn ) {
		const db_key: string = DB_KEY_GACHA_DATA.replace( "$gacha_type", gacha_type ).replace( "$uid", uid );
		const gacha_data_map: Record<string, string> = await redis.getHash( db_key );
		for ( let id in gacha_data_map ) {
			const gacha_data: Gacha_Info = JSON.parse( gacha_data_map[id] );
			lang = gacha_data.lang;
			const export_gacha_data: Standard_Gacha_Data = {
				id: gacha_data.id,
				name: gacha_data.name,
				item_id: gacha_data.item_id,
				item_type: gacha_data.item_type,
				gacha_id: gacha_data.gacha_id,
				gacha_type: gacha_data.gacha_type,
				rank_type: gacha_data.rank_type,
				count: gacha_data.count,
				time: gacha_data.time
			};
			gacha_data_list.push( export_gacha_data );
		}
	}
	
	if ( gacha_data_list.length === 0 ) {
		await sendMessage( `当前账号${ uid || "" }无历史抽卡数据.` );
		return;
	}
	
	const info: Standard_Gacha_Info = {
		uid,
		lang,
		export_app: 'Adachi-BOT',
		export_app_version: `v${ getVersion( bot.file ) }`,
		export_timestamp: Date.now() / 1000 | 0,
		region_time_zone: parseInt( `${ region_time_zone }` ) || 8,
		srgf_version: 'v1.0'
	}
	
	const export_data: Standard_Gacha = {
		info,
		list: gacha_data_list.sort( ( prev, curr ) => sortRecords( prev, curr ) )
	}
	
	if ( raw_message === 'json' ) {
		await export2JSON( export_data, bot );
	} else if ( raw_message === 'excel' ) {
		await export2Excel( export_data, bot );
	} else {
		await sendMessage( `不支持的导出类型: ${ raw_message }` );
	}
}
import { InputParameter } from "@modules/command";
import { analysisHandler, loadData } from "#sr_gacha_analysis/util/util";
import {
	DB_EXPIRE_24H,
	DB_KEY_GACHA_HTML_URL,
	DB_KEY_GACHA_URL,
	DB_KEY_GACHA_URL_DEFAULT,
	GACHA_URL_REG
} from "#sr_gacha_analysis/util/constants";


export async function main(
	i: InputParameter
): Promise<void> {
	const { sendMessage, messageData, redis, logger } = i;
	const { sender: { user_id }, raw_message } = messageData;
	const cn_api_domain: string = 'https://api-takumi.mihoyo.com';
	const os_api_domain: string = 'https://api-os-takumi.mihoyo.com';
	let url: string = '/common/gacha_record/api/getGachaLog';
	
	// style、sn暂时未用到
	let style: string = "";
	let sn: string = "";
	if ( GACHA_URL_REG.test( raw_message ) ) {
		// 链接方式
		try {
			const { searchParams, host } = new URL( raw_message );
			if ( host.includes( 'webstatic-sea' ) || host.includes( 'hkrpg-api-os' ) || host.includes( "api-os-takumi" ) ) {
				url = os_api_domain + url;
			} else {
				url = cn_api_domain + url;
			}
			if ( !searchParams.has( "authkey" ) ) {
				logger.warn( "URL中缺少authkey" );
				await sendMessage( "URL中缺少authkey" );
				return;
			}
			url += searchParams.toString();
			await redis.setString( DB_KEY_GACHA_URL_DEFAULT.replace( "$qq", user_id.toString() ), url, DB_EXPIRE_24H );
		} catch ( error: any ) {
			logger.error( `[星铁抽卡分析] 未匹配到可用的URL`, error );
			await sendMessage( <string>error );
			return;
		}
	} else {
		// Cookie方式
		// const reg: RegExp = new RegExp( /(?<sn>\d+)?(\s)*(?<style>饼图|头像)?/ );
		// const res: RegExpExecArray | null = reg.exec( raw_message );
		// style = res?.groups?.style || "饼图";
		// sn = res?.groups?.sn || "";
		// try {
		// 	url = await getUrl( sn, i );
		// } catch ( error ) {
		// 	logger.error( '[星铁抽卡分析] 链接生成失败:', error );
		// 	await sendMessage( `链接生成失败: ${ error }` );
		// 	return;
		// }
		await sendMessage( "暂不支持Cookie模式" );
		return;
	}
	
	try {
		await loadData( url, user_id, sn, i );
	} catch ( error ) {
		logger.error( "[星铁抽卡分析] 加载数据失败: ", error );
		const key: string = DB_KEY_GACHA_URL.replace( "$qq", user_id.toString() ).replace( "$sn", sn || "0" );
		const html_key: string = DB_KEY_GACHA_HTML_URL.replace( "$qq", user_id.toString() ).replace( "$sn", sn || "0" );
		await redis.deleteKey( key, html_key );
		await sendMessage( `加载数据失败: ${ error }` );
	}
	
	await analysisHandler( style, user_id, sendMessage );
}
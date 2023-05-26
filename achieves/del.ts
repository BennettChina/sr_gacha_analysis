import { InputParameter } from "@modules/command";
import { gacha_types_zh_cn } from "#sr_gacha_analysis/util/util";
import { DB_KEY_CURRENT_ID, DB_KEY_GACHA_DATA } from "#sr_gacha_analysis/util/constants";

export async function main( {
	                            sendMessage,
	                            messageData: { sender: { user_id } },
	                            redis
                            }: InputParameter ): Promise<void> {
	let uid: string = "";
	const current_uid_db_key = DB_KEY_CURRENT_ID.replace( "$qq", user_id.toString() );
	try {
		uid = await redis.getHashField( current_uid_db_key, "uid" );
	} catch ( error ) {
		await sendMessage( "暂无默认账号的历史记录" );
		return;
	}
	
	if ( !uid ) {
		await sendMessage( `暂无默认账号的历史记录` );
		return;
	}
	
	const keys: string[] = [ current_uid_db_key ];
	for ( let gacha_type in gacha_types_zh_cn ) {
		const db_key: string = DB_KEY_GACHA_DATA.replace( "$uid", uid ).replace( "$gacha_type", gacha_type );
		keys.push( db_key );
	}
	await redis.deleteKey( ...keys );
	
	await sendMessage( `已清除${ uid }的抽卡统计数据。` );
}
import { InputParameter } from "@modules/command";
import { analysisHandler } from "#sr_gacha_analysis/util/util";
import { DB_KEY_CURRENT_ID } from "#sr_gacha_analysis/util/constants";

export async function main(
	{ sendMessage, messageData, redis }: InputParameter
): Promise<void> {
	const { sender: { user_id }, raw_message } = messageData;
	let uid = '';
	try {
		uid = await redis.getHashField( DB_KEY_CURRENT_ID.replace( "$qq", user_id.toString() ), "uid" );
	} catch ( error ) {
		await sendMessage( "暂无历史记录" );
		return;
	}
	
	if ( !uid ) {
		await sendMessage( "暂无历史记录" );
		return;
	}
	
	await analysisHandler( raw_message, user_id, sendMessage );
}
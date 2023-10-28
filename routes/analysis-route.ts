import express from "express";
import bot from "ROOT";
import { gacha_types_zh_cn, sortRecords } from "#/sr_gacha_analysis/util/util";
import { Gacha_Info } from "#/sr_gacha_analysis/util/types";
import { DB_KEY_CURRENT_ID, DB_KEY_GACHA_DATA } from "#/sr_gacha_analysis/util/constants";

const router = express.Router();

router.get( "/result", async ( req, res ) => {
	const qq: number = parseInt( <string>req.query.qq );
	const uid = await bot.redis.getHashField( DB_KEY_CURRENT_ID.replace( "$qq", qq.toString() ), "uid" );
	let dataRes: any[] = [];
	for ( let gacha_type in gacha_types_zh_cn ) {
		try {
			const db_key: string = DB_KEY_GACHA_DATA.replace( "$gacha_type", gacha_type ).replace( "$uid", uid );
			const data: Record<string, string> = await bot.redis.getHash( db_key );
			const records: Gacha_Info[] = Object.values( data ).map( __data => JSON.parse( __data ) ).sort( ( prev, curr ) => sortRecords( prev, curr ) );
			dataRes.push( {
				key: gacha_type,
				name: gacha_types_zh_cn[gacha_type],
				data: records
			} );
		} catch ( error ) {
			bot.logger.error( `[星铁抽卡分析] ${ gacha_type }: `, error );
		}
	}
	
	res.send( { data: JSON.stringify( dataRes ), uid } );
} );

export default router;
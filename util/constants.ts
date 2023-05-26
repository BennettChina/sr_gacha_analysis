export const DB_KEY_CURRENT_ID: string = "sr_gacha.analysis.curr_uid:$qq";
export const DB_KEY_GACHA_POOL_INFO: string = "sr_gacha.pool.info";
export const DB_KEY_GACHA_URL_DEFAULT: string = "sr_gacha.url.api.$qq.0";
export const DB_KEY_GACHA_URL: string = "sr_gacha.url.api.$qq.$sn";
export const DB_KEY_GACHA_HTML_URL: string = "sr_gacha.url.html.$qq.$sn";
export const DB_KEY_GACHA_DATA: string = "sr_gacha.data.$uid.$gacha_type";
export const DB_EXPIRE_24H: number = 24 * 60 * 60;

export const GACHA_URL_REG: RegExp = /webstatic([^.]{2,10})?\.(mihoyo|hoyoverse)\.com/;
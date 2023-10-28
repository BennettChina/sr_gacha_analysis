const template = `
<div class="main2">
	<span class="header">UID{{uid}}的抽卡记录分析</span>
	<div class="main">
		<template v-for="(record, key) in records" key="key">
			<div class="item" v-if="record.total > 0">
				<span class="title">{{record.gacha_name}}</span>
				<div style="width:400px;height:400px;"><v-chart class="chart" :option="record.option" autoresize /></div>
				<span class="time">{{record.time}}</span>
				<div class="info">
					<p><span class="total">总计 <span class="lj">{{ record.total }}</span> 抽 已累计 <span class="wc">{{record.pity}}</span> 抽未出5星</span></p>
					<p>
						<span class="five"><span class="statistics">5星：{{record.weapon5+record.character5}}</span>[{{record.percent5}}]</span>
						<span class="four"><span class="statistics">4星：{{record.weapon4+record.character4}}</span>[{{record.percent4}}]</span>
						<span class="third"><span class="statistics">3星：{{record.weapon3}}</span>[{{record.percent3}}]</span>
					</p>
					<p><div class="jl">
						<span>5星历史记录：</span>
						<span v-for="element in record.history" class="jl2">
							<span :style="{'color': getColor(element.name)}">{{element.name}}[{{element.count}}]&nbsp;</span>
						</span>
					</div></p>
					<p><span class="total">5星平均出货次数为：<span class="per">{{record.average5}}</span></span></p>
				</div>
			</div>
		</template>
		
		<div class="tips" v-show="showTips">您无抽卡记录，或者抽卡记录已全部过期。</div>
	</div>
	<div class="footer">Create by Adachi-BOT && Bennett</div>
</div>`;

const { defineComponent, reactive, toRefs } = Vue;
import request from "../../public/js/http.js";
import { urlParamsGet } from "../../public/js/url.js";
import { getRandomNum } from "../../public/js/util.js";

export default defineComponent( {
	name: "AnalysisApp",
	template,
	components: { 'v-chart': window.VueECharts },
	setup() {
		const urlParams = urlParamsGet( location.href );
		const data = request( `/analysis/result?qq=${ urlParams.qq }` );
		const dataRecords = JSON.parse( data.data );
		const state = reactive( {
			uid: "",
			records: [],
			showTips: dataRecords.length === 0,
		} );
		
		// 定义一个 echarts 要用到到 map ，用来存放数据项名称、数据项的颜色
		const map = {
			"character5": {
				name: "5星角色",
				color: "#FAC858"
			},
			"weapon5": {
				name: "5星光锥",
				color: "#EE6666"
			},
			"character4": {
				name: "4星角色",
				color: "#5470C6"
			},
			"weapon4": {
				name: "4星光锥",
				color: "#91CC75"
			},
			"weapon3": {
				name: "3星光锥",
				color: "#73C0DE"
			}
		};
		const tmp = {};
		for ( let element of dataRecords ) {
			let total = element.data.length;
			const record = {
				total,
				gacha_type: element.key,
				gacha_name: element.name,
				weapon5: 0,
				character5: 0,
				weapon4: 0,
				character4: 0,
				weapon3: 0,
				pity: 0,
				average5: 0,
				percent5: 0,
				percent4: 0,
				percent3: 0,
				history: [],
				time: total > 0 ? `${ element.data[0].time.split( " " )[0] }  ~  ${ element.data[total - 1].time.split( " " )[0] }` : "-",
				option: {}
			}
			for ( let item of element.data ) {
				state.uid = item.uid;
				// 未出5星数量自增，后面出了再重置为0
				record.pity++;
				if ( item.rank_type === '3' ) {
					record.weapon3++;
				} else if ( item.rank_type === '4' ) {
					if ( item.item_type === '光锥' ) {
						record.weapon4++;
					} else {
						record.character4++;
					}
				} else {
					record.history.push( { name: item.name, count: record.pity } )
					// 出5星就置0
					record.pity = 0;
					if ( item.item_type === '光锥' ) {
						record.weapon5++;
					} else {
						record.character5++;
					}
				}
			}
			const total5 = record.total - record.pity;
			record.average5 = total5 === 0 ? 0 : ( total5 / ( record.weapon5 + record.character5 ) ).toFixed( 2 );
			record.percent3 = total === 0 ? "0%" : ( record.weapon3 / total * 100 ).toFixed( 2 ) + "%";
			record.percent4 = total === 0 ? "0%" : ( ( record.weapon4 + record.character4 ) / total * 100 ).toFixed( 2 ) + "%";
			record.percent5 = total === 0 ? "0%" : ( ( record.weapon5 + record.character5 ) / total * 100 ).toFixed( 2 ) + "%";
			
			const color = [], data = [];
			for ( let key in map ) {
				// 角色池没有5星光锥、光锥池没有5星角色
				if ( !record[key] ) continue;
				data.push( { name: map[key].name, value: record[key] } );
				color.push( map[key].color );
			}
			
			record.option = {
				legend: {
					left: 'center',
					top: '10%',
					selected: {
						'3星光锥': record.weapon3 <= 20
					}
				},
				textStyle: {
					fontFamily: 'GachaFont',
					fontStyle: 'normal',
				},
				series: [ {
					type: 'pie',
					stillShowZeroSum: false,
					top: 50,
					radius: '50%',
					startAngle: 70,
					color,
					data
				} ]
			}
			
			tmp[element.key] = record;
		}
		state.records = [ tmp['11'], tmp['12'], tmp['1'], tmp['2'] ].filter( t => !!t );
		const getColor = function ( name ) {
			let index = getRandomNum( 0, color_pool.length - 1 );
			if ( nameColor[name] ) {
				return nameColor[name];
			}
			// //颜色用尽 返回默认颜色
			if ( Object.keys( usedColor ).length >= color_pool.length ) {
				usedColor = {};
				return getColor( name );
			}
			let color = color_pool[index];
			while ( usedColor[color] ) {
				index = getRandomNum( 0, color_pool.length - 1 );
				color = color_pool[index];
			}
			usedColor[color] = 1;
			nameColor[name] = color;
			return color;
		}
		return {
			...toRefs( state ),
			getColor
		}
	}
} );

//颜色池
const color_pool = [
	'#5470C6', '#FAC858', '#EE6666', '#73C0DE', '#3BA272', '#FC8452', '#9A60B4', '#EA7CCC', '#2AB7CA',
	'#005B96', '#FF8B94', '#72A007', '#B60D1B', '#16570D'
]
let usedColor = {}
let nameColor = {}
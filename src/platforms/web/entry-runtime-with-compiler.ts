// 入口文件
import Vue from './runtime-with-compiler'
import * as vca from 'v3'
import { extend } from 'shared/util'

extend(Vue, vca)

console.info('extend--vca',vca)
console.info('extend--Vue',Vue)

import { effect } from 'v3/reactivity/effect'
Vue.effect = effect

export default Vue

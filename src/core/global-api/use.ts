import type { GlobalAPI } from 'types/global-api'
import { toArray, isFunction } from '../util/index'

// Vue._installedPlugins // 全局插件存放地址,如果没有该参数直接在该方法中定义,放在全局为了判断是否重复注册
export function initUse(Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | any) {
    const installedPlugins =
      this._installedPlugins || (this._installedPlugins = [])
    // 如果插件已经存在,则返回该对象
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters 获取除第一个的参数数组
    const args = toArray(arguments, 1)
    // 将当前的Vue添加到参数的最前面, 返回数组的新长度, 原数组发生变化
    args.unshift(this)
    // 如果插件的对象的install是函数则执行install函数,如果插件是函数则执行该函数,将原本的use里面的参数的第一个插入Vue,然后再执行
    /**
     * 如 调用Vue.use({
      *   install: function(vue,options){
      *     console.log(vue,options)
      *   }
      * },{
      *   ceshi: 'ceshi'
      * })
      * 则 将执行function(vue,options) 函数,vue的参数代表当前对象,options=>{ceshi: 'ceshi'}=>即对应use传入的参数(从第二个参数开始)
     */

    if (isFunction(plugin.install)) {
      plugin.install.apply(plugin, args)
    } else if (isFunction(plugin)) {
      plugin.apply(null, args)
    }
    // 最后把插件传入到全局参数中，数组为引用调用,等同于this._installedPlugins.push(plugin)
    installedPlugins.push(plugin)
    return this
  }
}

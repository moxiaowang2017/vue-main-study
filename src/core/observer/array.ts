// 数组拦截器
/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { TriggerOpTypes } from '../../v3'
import { def } from '../util/index'

const arrayProto = Array.prototype // 数组原型
// 创建数组对象，并导出 => 导出的对象 methodsToPatch 数据里面的方法已被拦截并重构
export const arrayMethods = Object.create(arrayProto) 
// arrayMethods 和 arrayProto 不是同一个对象
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * 将每个methodsToPatch里面的方法都转换成function mutator(...args){...} 对应的方法
 * 当数组调用这些方法时, 相当于调用了这个里面的对应方法
 * 只对arrayMethods 这个对象有效
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator(...args) {
    const result = original.apply(this, args)
    // __ob__ 调用该方法时传入
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    if (__DEV__) {
      ob.dep.notify({
        type: TriggerOpTypes.ARRAY_MUTATION,
        target: this,
        key: method
      })
    } else {
      ob.dep.notify()
    }
    return result
  })
})

import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import { unicodeRegExp } from './lang'
import { nativeWatch, hasSymbol } from './env'
import { isArray, isFunction } from 'shared/util'

import { ASSET_TYPES, LIFECYCLE_HOOKS } from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'
import type { Component } from 'types/component'
import type { ComponentOptions } from 'types/options'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
if (__DEV__) {
  strats.el = strats.propsData = function (
    parent: any,
    child: any,
    vm: any,
    key: any
  ) {
    if (!vm) {
      warn(
        // 选项 ${key} 只能在实例期间使用,可以使用'new'关键字创建。
        `option "${key}" can only be used during instance ` +
          'creation with the `new` keyword.'
      )
    }
    console.info('strats.el',parent,child)
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 */
function mergeData(
  to: Record<string | symbol, any>,
  from: Record<string | symbol, any> | null,
  recursive = true
): Record<PropertyKey, any> {
  if (!from) return to // 如果from的数值没有值,则返回to的值
  let key, toVal, fromVal

  const keys = hasSymbol
    ? (Reflect.ownKeys(from) as string[])
    : Object.keys(from)

  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    // in case the object is already observed...
    if (key === '__ob__') continue
    toVal = to[key]
    fromVal = from[key]
    if (!recursive || !hasOwn(to, key)) {
      set(to, key, fromVal)
    } else if (
      toVal !== fromVal &&
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
    ) {
      mergeData(toVal, fromVal)
    }
  }
  return to
}

/**
 * Data
 */
export function mergeDataOrFn(
  parentVal: any,
  childVal: any,
  vm?: Component
): Function | null {
  if (!vm) {
    // 如果子组件的数据为空,则返回父组件的数据
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      return parentVal
    }
    // 如果父组件的数据为空,则返回子组件的数据
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn() {
      return mergeData(
        isFunction(childVal) ? childVal.call(this, this) : childVal, // 如果子组件的数据是函数,则返回函数的执行结果,否则返回当前子组件的数据
        isFunction(parentVal) ? parentVal.call(this, this) : parentVal // 如果父组件的数据是函数,则返回函数的执行结果,否则返回当前父组件的数据
      )
    }
  } else {
    return function mergedInstanceDataFn() {
      // instance merge
      const instanceData = isFunction(childVal)
        ? childVal.call(vm, vm)
        : childVal
      const defaultData = isFunction(parentVal)
        ? parentVal.call(vm, vm)
        : parentVal
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): Function | null {
  if (!vm) {
    // 如果子组件的data不是函数,会发出警告,并返回父组件的data
    if (childVal && typeof childVal !== 'function') {
      __DEV__ &&
        warn(
          'The "data" option should be a function ' +
            'that returns a per-instance value in component ' +
            'definitions.',
          vm
        )

      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 */
export function mergeLifecycleHook(
  parentVal: Array<Function> | null,
  childVal: Function | Array<Function> | null
): Array<Function> | null {
  const res = childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : isArray(childVal)
      ? childVal
      : [childVal]
    : parentVal
  return res ? dedupeHooks(res) : res
}

function dedupeHooks(hooks: any) {
  const res: Array<any> = []
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i])
    }
  }
  return res
}

LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeLifecycleHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
function mergeAssets(
  parentVal: Object | null,
  childVal: Object | null,
  vm: Component | null,
  key: string
): Object {
  const res = Object.create(parentVal || null)
  if (childVal) {
    __DEV__ && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } else {
    return res
  }
}

ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
strats.watch = function (
  parentVal: Record<string, any> | null,
  childVal: Record<string, any> | null,
  vm: Component | null,
  key: string
): Object | null {
  // work around Firefox's Object.prototype.watch...
  //@ts-expect-error work around
  if (parentVal === nativeWatch) parentVal = undefined
  //@ts-expect-error work around
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  if (!childVal) return Object.create(parentVal || null)
  if (__DEV__) {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret: Record<string, any> = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent ? parent.concat(child) : isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 */
strats.props =
  strats.methods =
  strats.inject =
  strats.computed =
    function (
      parentVal: Object | null,
      childVal: Object | null,
      vm: Component | null,
      key: string
    ): Object | null {
      if (childVal && __DEV__) {
        assertObjectType(key, childVal, vm)
      }
      if (!parentVal) return childVal
      const ret = Object.create(null)
      extend(ret, parentVal)
      if (childVal) extend(ret, childVal)
      return ret
    }

strats.provide = function (parentVal: Object | null, childVal: Object | null) {
  if (!parentVal) return childVal
  return function () {
    const ret = Object.create(null)
    mergeData(ret, isFunction(parentVal) ? parentVal.call(this) : parentVal)
    if (childVal) {
      mergeData(
        ret,
        isFunction(childVal) ? childVal.call(this) : childVal,
        false // non-recursive
      )
    }
    return ret
  }
}

/**
 * 如果第二个参数没有值,则返回第一个参数,如果第二个参数有值,则返回第一个
 * Default strategy.
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined ? parentVal : childVal
}

/**
 * Validate component names
 */
function checkComponents(options: Record<string, any>) {
  // 遍历组件列表,对组件的名称进行校验
  for (const key in options.components) {
    validateComponentName(key)
  }
}

/**
 * 对组件名称进行校验
 * 1.正则校验
 * 2.名称不能是slot、component
 * 3.config.isReservedTag 不能是html标签,也不能是svg标签
 * @param name 
 */
export function validateComponentName(name: string) {
  if (
    !new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)
  ) {
    warn(
      'Invalid component name: "' +
        name +
        '". Component names ' +
        'should conform to valid custom element name in html5 specification.'
    )
  }
  console.info('====================isReservedTag=================',config.isReservedTag)
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
        'id: ' +
        name
    )
  }
}

/**
 * 规范化props
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
function normalizeProps(options: Record<string, any>, vm?: Component | null) {
  const props = options.props
  if (!props) return
  const res: Record<string, any> = {}
  let i, val, name
  if (isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        name = camelize(val) // 驼峰化参数名称，如table-body => tableBody
        res[name] = { type: null } // 将数组中的参数放到res中，并且type默认赋值为null
      } else if (__DEV__) {
        warn('props must be strings when using array syntax.') // 使用数组语法时，props必须是字符串
      }
    }
  } else if (isPlainObject(props)) { // 如果是对象,则遍历对象
    for (const key in props) {
      val = props[key]
      name = camelize(key) // 驼峰化参数名
      /**
       * 如果参数是对象，则直接返回, 不然 转换成{type: val}的形式
       * 如tableVi: String => tableVi: {type: String}
       * */ 
      res[name] = isPlainObject(val) ? val : { type: val }  
    }
  } else if (__DEV__) {
    // 如果不符合上述内容,则开发环境发出警告: 你的参数值不符合预期,期待是数组或者是对象,但是获取到了其他类型
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
        `but got ${toRawType(props)}.`,
      vm
    )
  }
  // 最后将处理过的props 放到options.props里面,如果不符合规则,则返回空对象
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 */
function normalizeInject(options: Record<string, any>, vm?: Component | null) {
  const inject = options.inject
  if (!inject) return
  // 将options.inject置为空对象, 并且重定义一个参数normalized,并且进行引用赋值=>normalized改动,将同步改动options.inject的值
  const normalized: Record<string, any> = (options.inject = {})
  /**
   *  如果是数组将inject 的格式转换为对象
   *  如: ['tableContent','tableFoot'] =>
   *  {
   *    'tableContent': {
   *      from: 'tableContent'
   *    },
   *    'tableFoot': {
   *      from: 'tableFoot'
   *    }
   *  }
   */
  if (isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) { // 如果是对象则遍历格式化数据
    for (const key in inject) {
      const val = inject[key]
      /**
       * 如果参数是对象，则直接返回, 不然 转换成{from: val}的形式
       * 如'tableVi': 'table' => tableVi: {from: 'table'}
       * */ 
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (__DEV__) {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
        `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * 规范化directive
 * Normalize raw function directives into object format.
 */
function normalizeDirectives(options: Record<string, any>) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      // 如果对象value值是函数,则将函数同时挂载在bind和update上
      if (isFunction(def)) {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

function assertObjectType(name: string, value: any, vm: Component | null) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
        `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
export function mergeOptions(
  parent: Record<string, any>,
  child: Record<string, any>,
  vm?: Component | null
): ComponentOptions {
  console.log('mergeOptions')
  if (__DEV__) {
    /**
     * 遍历child.components,并校验组件名称=> 
     * 1.正则校验
     * 2.名称不能是slot、component
     * 3.config.isReservedTag 不能是html标签,也不能是svg标签
     * 4.名称不对报相应的警告
     **/ 
    checkComponents(child)
  }

  // 如果child是函数,则child为child.options
  if (isFunction(child)) {
    // @ts-expect-error
    child = child.options
  }
  /**
   * 处理参数props
   * 1.驼峰化参数名;
   * 2.格式化参数: 
   *   {
   *      参数名1: {
   *        type: 类型1,
   *        ... // 如default、value
   *      }, 
   *      参数名2: {
   *        type: 类型2,
   *        ...
   *      }
   *   }
   * 3. 如果格式不是数组或对象,则发出警告,并返回空对象
   */
  normalizeProps(child, vm)
  /**
   * 处理参数inject
   * 1.格式化参数: 
   *   {
   *      参数名1: {
   *        from: 类型1,
   *        ... // 如default、value
   *      }, 
   *      参数名2: {
   *        from: 类型2,
   *        ...
   *      }
   *   }
   * 2. 如果格式不是数组或对象,则发出警告,并返回空对象
   */
  normalizeInject(child, vm)
  /**
   * 处理参数directives
   * 1.当对象value值是函数,则将函数同时挂载在bind和update上,其他的原样返回
   */
  normalizeDirectives(child)

  // Apply extends and mixins on the child options,
  // but only if it is a raw options object that isn't
  // the result of another mergeOptions call.
  // Only merged options has the _base property.
  /**
   * 如果child._base为空, 则将子组件的extends合并到父组件,遍历子组件的mixins,也合并到父组件
   */
  if (!child._base) {
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm)
    }
    if (child.mixins) {
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm)
      }
    }
  }

  const options: ComponentOptions = {} as any
  let key
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    // 如果子组件的参数配置项不在父组件的参数配置项中
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField(key: any) {
    // strats[key] => 不用的key返回不同的方法,合并父组件和子组件的不同方式
    /**
     * el: 优先返回子组件的el值
     */
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset(
  options: Record<string, any>,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (__DEV__ && warnMissing && !res) {
    warn('Failed to resolve ' + type.slice(0, -1) + ': ' + id)
  }
  return res
}

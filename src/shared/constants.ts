export const SSR_ATTR = 'data-server-rendered'

export const ASSET_TYPES = ['component', 'directive', 'filter'] as const

// 生命周期钩子名称数组
export const LIFECYCLE_HOOKS = [
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'beforeDestroy',
  'destroyed',
  'activated',
  'deactivated',
  'errorCaptured',
  'serverPrefetch',
  'renderTracked',
  'renderTriggered'
] as const

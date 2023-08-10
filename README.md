## 目录结构
```
├── scripts   # 与构建相关的脚本和配置文件
├── dist      # 构建后的文件
├── flow      # Flow的类型声明
├── packages  # vue-server-renderer和vue-template-compiler，它们作为单独的NPM包发布
├── test      # 所有的测试代码
├── src       # 源代码   
    ├── compiler  # 与模板编译相关的代码
    ├── core      # 通用的、与平台无关的运行时代码 
        ├── observer         # 实现变化侦测的代码 
        ├── vdom             # 实现虚拟DOM的代码 
        ├── instance         # Vue.js实例的构造函数和原型方法
        ├── global-api       # 全局API的代码
        └── components       # 通用的抽象组件 
├── server               # 与服务端渲染相关的代码 
├── platforms            # 特定平台代码
├── sfc                  # 单文件组件（* .vue文件）解析逻辑
└── shared               # 整个项目的公用工具代码
└── types                # TypeScript类型定义    
└── test                 # 类型定义测试
```
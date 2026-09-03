import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/harness-study/',
  title: 'harness-study',
  description:
    '从零学 agent harness 的渐进式学习项目：亲手造七层 loop，再用 harness 工程方法把环境装上。',
  cleanUrls: true,
  appearance: 'auto',
  head: [
    ['link', { rel: 'icon', href: '/harness-study/favicon.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }]
  ],
  themeConfig: {
    nav: [
      { text: '路线', link: '/' },
      { text: '阅读', link: '/REFERENCES' },
      { text: '拆解', link: '/FRONTIER-HARNESS' },
      { text: '环境', link: '/ENVIRONMENT-HARNESS' }
    ],
    sidebar: {
      '/': [
        {
          text: '学习路线',
          items: [
            { text: '总览 / 阶段 0-5', link: '/' }
          ]
        },
        {
          text: '教程文档',
          items: [
            { text: 'ROADMAP 路线详情', link: '/ROADMAP' },
            { text: 'REFERENCES 阅读清单', link: '/REFERENCES' },
            { text: 'FRONTIER-HARNESS 前沿拆解', link: '/FRONTIER-HARNESS' },
            { text: 'ENVIRONMENT-HARNESS 五子系统', link: '/ENVIRONMENT-HARNESS' }
          ]
        },
        {
          text: '回到源码',
          items: [
            { text: 'GitHub 仓库', link: 'https://github.com/wgcairui/harness-study' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/wgcairui/harness-study' }
    ],
    outline: { level: [2, 3] },
    docFooter: { prev: '上一篇', next: '下一篇' },
    footer: {
      message: 'MIT License · 适配 walkinglabs Learn Harness Engineering 课程（MIT）',
      copyright: 'Copyright © 2026 cairui'
    }
  }
})

# Repository Instructions

- 工单的任何业务修改都必须通过 `src/state-machine/ticketStateMachine.js` 的事件分发完成。
- 禁止在接口、store、前端组件里直接写入工单的 `status`、`requesterStatus`、`supportStatus`、`processingSubStatus`。
- 工单创建同样属于状态机事件；新建工单必须通过 `SUBMIT` 事件进入状态流转。
- 如果需要新增工单编辑能力，先补充状态机事件，再接入接口和界面，不要绕过状态机直接落库。
- 涉及 UI 交互、页面布局或视觉方案讨论时，允许默认使用浏览器可视化辅助进行 mockup、对比和验证。

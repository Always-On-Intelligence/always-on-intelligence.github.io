import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { withInjectableUi } from './extendableSystem'

const AppStatusBase = ({ status, isError, children }: any) => {
  const zh = new URLSearchParams(location.search).get('lang') === 'zh'
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])
  const stage = String(status ?? '').replace('Loading chunks', zh ? '正在生成地形' : 'Loading chunks').replace('Loading world', zh ? '正在加载世界' : 'Loading world').replace('Setting callbacks', zh ? '正在连接游戏控制' : 'Setting callbacks').replace('Waiting for tasks', zh ? '正在完成初始化' : 'Waiting for tasks')
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 10_000, display: 'grid', placeContent: 'center', textAlign: 'center', padding: 24, color: '#315348', background: 'linear-gradient(145deg,#f0f5ed,#dae8e1 55%,#b3cece)', font: '15px/1.6 system-ui,sans-serif' }}>
      <img src='./favicon.png' alt='' style={{ width: 52, height: 52, borderRadius: 13, margin: '0 auto 18px' }} />
      <div style={{ fontSize: 19, fontWeight: 600 }}>{isError ? (zh ? '场景暂时未能加载' : 'The scene could not load') : (zh ? '正在准备你的场景…' : 'Preparing your scene…')}</div>
      <div style={{ fontSize: 13, opacity: .7, marginTop: 8 }}>{isError ? (zh ? '请刷新重试。' : 'Please refresh to try again.') : (zh ? '正在加载地形与眼镜视角' : 'Loading the world and your glasses')}</div>
      {!isError && <><div role='status' style={{ fontSize: 13, marginTop: 18, maxWidth: 540, overflowWrap: 'anywhere' }}>{stage} · {elapsed}s</div><small style={{ display: 'block', maxWidth: 540, marginTop: 10, opacity: .75 }}>{zh ? '首次生成校园需要一些时间，请保持此页面在前台。无需反复刷新。' : 'The first campus load takes time. Keep this tab visible; repeated refreshes restart loading.'}</small>{elapsed >= 45 && <button style={{ margin: '16px auto', padding: '8px 16px', border: '1px solid #a9c8b8', borderRadius: 10, background: '#fff', color: '#315348', cursor: 'pointer' }} onClick={() => location.reload()}>{zh ? '长时间没有进度？重新加载' : 'No progress? Reload'}</button>}</>}
      <div style={{ margin: '14px auto 0' }}>{children}</div>
      {isError && <><button style={{ margin: '20px auto', padding: '10px 20px', border: '1px solid #a9c8b8', borderRadius: 12, background: '#fff', color: '#315348', cursor: 'pointer' }} onClick={() => location.reload()}>{zh ? '重新加载' : 'Try again'}</button><details style={{ fontSize: 12, maxWidth: 540, overflowWrap: 'anywhere' }}><summary>{zh ? '错误详情' : 'Error details'}</summary>{String(status)}</details></>}
    </div>, document.body
  )
}
export default withInjectableUi(AppStatusBase, 'appStatus')

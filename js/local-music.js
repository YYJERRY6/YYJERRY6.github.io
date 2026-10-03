(() => {
  if (window.__localMusicInstalled) return
  window.__localMusicInstalled = true
  let active = null

  const release = () => {
    if (!active) return
    const previous = active
    active = null
    ++previous.attempt
    clearTimeout(previous.timer)
    previous.listeners.abort()
    previous.audio.pause()
    previous.audio.removeAttribute('src')
    previous.audio.load()
  }

  const init = () => {
    const root = document.querySelector('[data-local-music]')
    if (!root || active?.root === root) return
    release()
    const audio = root.querySelector('[data-music-audio]')
    const status = root.querySelector('[data-music-status]')
    const retry = root.querySelector('[data-music-retry]')
    const state = { root, audio, status, retry, attempt: 0, timer: null, listeners: new AbortController() }
    const listen = (target, event, handler) => target.addEventListener(event, handler, { signal: state.listeners.signal })
    active = state
    const message = (text, canRetry = false) => {
      if (active !== state) return
      status.textContent = text
      retry.hidden = !canRetry
    }
    const waiting = () => {
      message('正在缓冲，请稍候…')
      clearTimeout(state.timer)
      state.timer = setTimeout(() => message('加载时间较长，可以重试或单独打开音频。', true), 12000)
    }
    listen(audio, 'waiting', waiting)
    listen(audio, 'playing', () => {
      clearTimeout(state.timer)
      message('正在播放')
    })
    listen(audio, 'pause', () => {
      clearTimeout(state.timer)
      if (!audio.error) message('已暂停')
    })
    listen(audio, 'ended', () => {
      clearTimeout(state.timer)
      message('播放完毕，可以选择下一首。')
    })
    listen(audio, 'error', () => {
      clearTimeout(state.timer)
      const errors = {
        1: '播放已中断，请重试。',
        2: '音频下载失败，请重试或检查网络。',
        3: '浏览器无法解码这首音频，请尝试单独打开。',
        4: '音频地址不可用或浏览器不支持该格式，请尝试单独打开。'
      }
      message(errors[audio.error?.code] || '音频加载失败，请重试。', true)
    })
    const start = () => {
      const attempt = ++state.attempt
      waiting()
      Promise.resolve(audio.play()).catch(error => {
        if (active !== state || attempt !== state.attempt || error.name === 'AbortError') return
        clearTimeout(state.timer)
        message(error.name === 'NotAllowedError' ? '浏览器阻止了播放，请点击播放器里的播放按钮。' : '播放失败，请重试或单独打开音频。', true)
      })
    }
    listen(root, 'click', event => {
      const button = event.target.closest('[data-music-src]')
      if (button) {
        ++state.attempt
        audio.pause()
        clearTimeout(state.timer)
        audio.src = button.dataset.musicSrc
        audio.load()
        root.querySelector('[data-music-title]').textContent = button.textContent
        root.querySelector('[data-music-link]').href = button.dataset.musicSrc
        root.querySelectorAll('[data-music-src]').forEach(item => {
          if (item === button) item.setAttribute('aria-current', 'true')
          else item.removeAttribute('aria-current')
        })
        start()
      } else if (event.target.closest('[data-music-retry]')) {
        audio.load()
        start()
      }
    })
  }
  document.addEventListener('pjax:send', release)
  window.addEventListener('pagehide', release)
  window.addEventListener('pageshow', init)
  document.addEventListener('pjax:complete', init)
  init()
})()

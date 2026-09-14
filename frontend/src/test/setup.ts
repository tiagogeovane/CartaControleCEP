import '@testing-library/jest-dom/vitest'

if (typeof window !== 'undefined') {
  // Polyfill para ResizeObserver no ambiente jsdom
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }

  // Dimensões do DOM no jsdom para o ECharts calcular layouts
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: function () {
      return 800
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: function () {
      return 600
    },
  })

  // Polyfill de Canvas para o ECharts e ZRender no jsdom
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextType: string) {
      if (contextType === '2d') {
        const ctx: any = {
          fillRect: () => {},
          clearRect: () => {},
          getImageData: (_x: number, _y: number, w: number, h: number) => ({
            data: new Array(w * h * 4).fill(0),
          }),
          putImageData: () => {},
          createImageData: () => [],
          setTransform: () => {},
          drawImage: () => {},
          save: () => {},
          fillText: () => {},
          restore: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          stroke: () => {},
          translate: () => {},
          scale: () => {},
          rotate: () => {},
          arc: () => {},
          fill: () => {},
          measureText: () => ({ width: 50, height: 12 }),
          transform: () => {},
          rect: () => {},
          clip: () => {},
          createLinearGradient: () => ({
            addColorStop: () => {},
          }),
          createRadialGradient: () => ({
            addColorStop: () => {},
          }),
          createPattern: () => ({}),
          bezierCurveTo: () => {},
          quadraticCurveTo: () => {},
          isPointInPath: () => false,
          setLineDash: () => {},
          getLineDash: () => [],
          dpr: 1,
          canvas: this,
        }
        return ctx
      }
      return null
    } as any

    HTMLCanvasElement.prototype.toDataURL = function () {
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    }
  }
}

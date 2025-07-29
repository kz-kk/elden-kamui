export class GLContext {
  static gl = null;
  static canvas = null;

  static init(canvas) {
    if (this.gl) return this.gl;

    this.canvas = canvas;
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!this.gl) {
      console.error('WebGL not supported');
      return null;
    }

    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);
    
    return this.gl;
  }

  static getContext() {
    return this.gl;
  }

  static getCanvas() {
    return this.canvas;
  }

  static clear(r = 0, g = 0, b = 0, a = 0) {
    if (!this.gl) return;
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  static resize(width, height) {
    if (!this.gl) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }
}
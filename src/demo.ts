import { Engine } from './core/Engine';
import { Renderer } from './renderer/Renderer';
import { ShaderProgram } from './renderer/ShaderProgram';
import { VertexBuffer } from './renderer/VertexBuffer';
import { IndexBuffer } from './renderer/IndexBuffer';
import { VertexArray } from './renderer/VertexArray';
import { Matrix4 } from './math/Matrix4';
import { basicVert, basicFrag } from './renderer/shaders';

const engine = new Engine('#engine-canvas');
engine.init();

const gl = engine.gl;
const renderer = new Renderer(gl);

// --- Shader ---
const program = ShaderProgram.create(gl, basicVert, basicFrag);

// --- Triangle geometry (interleaved: pos xyz + color rgb) ---
// prettier-ignore
const vertices = new Float32Array([
  // x,     y,    z,    r,    g,    b
   0.0,   0.5,  0.0,  1.0,  0.0,  0.0,  // top — red
  -0.5,  -0.5,  0.0,  0.0,  1.0,  0.0,  // bottom-left — green
   0.5,  -0.5,  0.0,  0.0,  0.0,  1.0,  // bottom-right — blue
]);

const indices = new Uint16Array([0, 1, 2]);

const vbo = new VertexBuffer(gl, vertices);
const ibo = new IndexBuffer(gl, indices);
const vao = new VertexArray(gl);

const FLOAT = 4; // bytes
const stride = 6 * FLOAT; // 3 pos + 3 color

vao.addVertexBuffer(vbo, [
  { location: 0, size: 3, stride, offset: 0 },          // a_position
  { location: 1, size: 3, stride, offset: 3 * FLOAT },   // a_color
]);
vao.setIndexBuffer(ibo);

// Identity MVP — draws in clip space
const mvp = Matrix4.identity();

// Disable culling for the triangle (we want to see it from both sides)
renderer.setCullFace(false);

engine.on('render', () => {
  renderer.clear();
  renderer.resetStats();
  renderer.useProgram(program);
  program.setMat4('u_modelViewProjection', mvp.data);
  program.setVec4('u_color', 1, 1, 1, 1);
  renderer.drawElements(vao);
});

engine.start();

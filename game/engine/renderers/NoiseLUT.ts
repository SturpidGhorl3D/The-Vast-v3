import * as BABYLON from '@babylonjs/core';

export class NoiseLUT {
  public static createNoiseTexture3D(scene: BABYLON.Scene, size: number = 32): BABYLON.RawTexture3D {
    const total = size * size * size * 4;
    const data = new Uint8Array(total);
    for (let i = 0; i < total; i+=4) {
        data[i] = Math.floor(Math.random() * 256);
        data[i+1] = Math.floor(Math.random() * 256);
        data[i+2] = Math.floor(Math.random() * 256);
        data[i+3] = Math.floor(Math.random() * 256);
    }
    const tex = new BABYLON.RawTexture3D(data, size, size, size, BABYLON.Engine.TEXTUREFORMAT_RGBA, scene, false, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapR = BABYLON.Texture.WRAP_ADDRESSMODE;
    return tex;
  }
}

import {arrayXPointerFloat, pointerOnFloat} from './../nodes/utils/utils.js';
import WbWrenAbstractPostProcessingEffect from './WbWrenAbstractPostProcessingEffect.js';
import WbWrenPostProcessingEffects from './WbWrenPostProcessingEffects.js';

export default class WbWrenGtao extends WbWrenAbstractPostProcessingEffect {
  constructor() {
    super();
    this.halfResolution = false;

    this.near = 0.0;
    this.far = 0.0;
    this.fov = 0.78;
    this.radius = 2.0;
    this.flipNormalY = 0.0;
    this.frameCounter = 0;

    this.clipInfo = [0, 0, 0, 0];
    this.params = [0.0, 0.0, 0.0, 0.0];
    this.rotations = [60.0, 300.0, 180.0, 240.0, 120.0, 0.0];
    this.offsets = [0.0, 0.5, 0.25, 0.75];
    this.previousInverseViewMatrix = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0];

    this.previousAllocation = false;
  }

  applyOldInverseViewMatrixToWren() {
    if (typeof this.wrenPostProcessingEffect === 'undefined')
      return;

    if (this.previousAllocation)
      _free(this.previousInverseViewMatrixPointer);

    if (typeof this.previousInverseViewMatrix !== 'number') {
      this.previousInverseViewMatrixPointer = arrayXPointerFloat(this.previousInverseViewMatrix);
      this.previousAllocation = true;
    } else {
      this.previousInverseViewMatrixPointer = this.previousInverseViewMatrix;
      this.previousAllocation = false;
    }

    Module.ccall('wr_post_processing_effect_pass_set_program_parameter', null, ['number', 'string', 'number'], [this.temporalPass, 'previousInverseViewMatrix', this.previousInverseViewMatrixPointer]);
  }

  copyNewInverseViewMatrix(inverseViewMatrix) {
    this.previousInverseViewMatrix = inverseViewMatrix;
  }

  setFov(fov) {
    this.fov = fov;
    this._applyParametersToWren();
  }

  setHalfResolution(halfResolution) {
    this.halfResolution = halfResolution;
  }

  setQualityLevel(qualityLevel) {
    this.params[2] = 2 << (qualityLevel - 1);
    this._applyParametersToWren();
  }

  setRadius(radius) {
    this.radius = radius;
    this._applyParametersToWren();
  }

  setup(viewport) {
    if (typeof this.wrenPostProcessingEffect !== 'undefined') {
      // In case we want to update the viewport, the old postProcessingEffect has to be removed first
      if (this.wrenViewport === viewport)
        _wr_viewport_remove_post_processing_effect(this.wrenViewport, this.wrenPostProcessingEffect);

      _wr_post_processing_effect_delete(this.wrenPostProcessingEffect);
    }

    this.wrenViewport = viewport;

    let width = _wr_viewport_get_width(this.wrenViewport);
    let height = _wr_viewport_get_height(this.wrenViewport);

    if (this.halfResolution) {
      width = width <= 1.0 ? 2.0 : width;
      height = height <= 1.0 ? 2.0 : height;
    }

    const viewportFramebuffer = _wr_viewport_get_frame_buffer(this.wrenViewport);

    const depthTexture = _wr_frame_buffer_get_depth_texture(viewportFramebuffer);
    const normalTexture = _wr_frame_buffer_get_output_texture(viewportFramebuffer, 1);

    this.wrenPostProcessingEffect = WbWrenPostProcessingEffects.gtao(width, height, Enum.WR_TEXTURE_INTERNAL_FORMAT_RGBA16F, depthTexture, normalTexture, this.halfResolution);

    this.gtaoPass = Module.ccall('wr_post_processing_effect_get_pass', 'number', ['number', 'string'], [this.wrenPostProcessingEffect, 'gtaoForwardPass']);
    this.temporalPass = Module.ccall('wr_post_processing_effect_get_pass', 'number', ['number', 'string'], [this.wrenPostProcessingEffect, 'temporalDenoise']);
    this._applyParametersToWren();

    _wr_viewport_set_ambient_occlusion_effect(this.wrenViewport, this.wrenPostProcessingEffect);
    _wr_post_processing_effect_setup(this.wrenPostProcessingEffect);

    this.hasBeenSetup = true;
  }

  // Private functions

  _applyParametersToWren() {
    if (!this.wrenPostProcessingEffect)
      return;

    this.clipInfo[0] = this.near;
    this.clipInfo[1] = this.far ? this.far : 1000000.0;
    this.clipInfo[2] = 0.5 * (_wr_viewport_get_height(this.wrenViewport) / (2.0 * Math.tan(this.fov * 0.5)));

    if (typeof this.clipInfoPointer !== 'undefined')
      _free(this.clipInfoPointer);
    this.clipInfoPointer = arrayXPointerFloat(this.clipInfo);

    Module.ccall('wr_post_processing_effect_pass_set_program_parameter', null, ['number', 'string', 'number'], [this.gtaoPass, 'clipInfo', this.clipInfoPointer]);

    this.params[0] = this.rotations[this.frameCounter % 6] / 360.0;
    this.params[1] = this.offsets[Math.floor(this.frameCounter / 6) % 4];

    if (typeof this.paramsPointer !== 'undefined')
      _free(this.paramsPointer);
    this.paramsPointer = arrayXPointerFloat(this.params);
    Module.ccall('wr_post_processing_effect_pass_set_program_parameter', null, ['number', 'string', 'number'], [this.gtaoPass, 'params', this.paramsPointer]);

    if (typeof this.radiusPointer !== 'undefined')
      _free(this.radiusPointer);
    this.radiusPointer = pointerOnFloat(this.radius);
    Module.ccall('wr_post_processing_effect_pass_set_program_parameter', null, ['number', 'string', 'number'], [this.gtaoPass, 'radius', this.radiusPointer]);

    if (typeof this.flipNormalYPointer !== 'undefined')
      _free(this.flipNormalYPointer);
    this.flipNormalYPointer = pointerOnFloat(this.flipNormalY);
    Module.ccall('wr_post_processing_effect_pass_set_program_parameter', null, ['number', 'string', 'number'], [this.gtaoPass, 'flipNormalY', this.flipNormalYPointer]);
    ++this.frameCounter;
  }
}

var lastState;
export function rain(viewer){
    var rainEffect = new Cesium.PostProcessStage({
        fragmentShader:`
        uniform sampler2D colorTexture;
        in vec2 v_textureCoordinates;
        float hash(float x){
            return fract(sin(x*23.3)*13.13);
        }
        void main(){
            float time = czm_frameNumber / 120.0;
            vec2 resolution = czm_viewport.zw;
            vec2 uv=(gl_FragCoord.xy*2.-resolution.xy)/min(resolution.x,resolution.y);
            vec3 c=vec3(.6,.7,.8);
            float a=-.4;
            float si=sin(a),co=cos(a);
            uv*=mat2(co,-si,si,co);
            uv*=length(uv+vec2(0,8.9))*.3+1.;
            float v=1.-sin(hash(floor(uv.x*100.))*2.);
            float b=clamp(abs(sin(20.*time*v+uv.y*(5./(2.+v))))-.95,0.,1.)*20.;
            c*=v*b;
            out_FragColor = mix(texture(colorTexture, v_textureCoordinates), vec4(c, 1), 0.5);
        }`,
    });
    viewer.scene.postProcessStages.add(rainEffect);
    lastState = rainEffect;
}

export function stopRain(viewer){
    viewer.scene.postProcessStages.remove(lastState);
    lastState = null;
}

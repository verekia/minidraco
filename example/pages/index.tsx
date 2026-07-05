import { useEffect, useMemo, useState } from 'react'

import { OrbitControls } from '@react-three/drei/webgpu'
import { Canvas, useFrame, useThree } from '@react-three/fiber/webgpu'
import { AnimationMixer, Box3, Mesh, SkinnedMesh, Vector3 } from 'three'

import { useDracoGltf } from '../hooks/useDracoGltf'
import { DECODER_KINDS } from '../lib/loaders'

import type { Group, PerspectiveCamera } from 'three'

import type { DecoderKind } from '../lib/loaders'

const MODELS = [
  { label: 'Manablade characters', url: '/models/manablade-characters.glb' },
  { label: 'Manablade static', url: '/models/manablade-static.glb' },
]

const ALL_MESHES = '__all__'
const NO_ANIMATION = '__none__'

const collectMeshNames = (root: Group): string[] => {
  const names = new Set<string>()
  root.traverse(node => {
    if (node instanceof Mesh || node instanceof SkinnedMesh) names.add(node.name)
  })
  return [...names].toSorted()
}

const Model = ({
  scene,
  animations,
  meshFilter,
  animationName,
}: {
  scene: Group
  animations: { name: string }[]
  meshFilter: string
  animationName: string
}) => {
  const mixer = useMemo(() => new AnimationMixer(scene), [scene])
  const three = useThree()
  const { camera, controls } = three

  // Debug handle so automated browser checks can inspect the scene state
  useEffect(() => {
    ;(window as any).__three = three
  }, [three])

  // The R3F canary's WebGPU canvas sometimes misses its first present until a
  // resize reconfigures the swapchain; nudge it once the model is mounted.
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
    return () => cancelAnimationFrame(id)
  }, [scene, three])

  // Visual-debugging filter: hide every mesh except the selected one.
  useEffect(() => {
    scene.traverse(node => {
      if (node instanceof Mesh || node instanceof SkinnedMesh) {
        node.visible = meshFilter === ALL_MESHES || node.name === meshFilter
      }
    })
  }, [scene, meshFilter])

  useEffect(() => {
    mixer.stopAllAction()
    if (animationName === NO_ANIMATION) return
    const clip = (animations as any[]).find(c => c.name === animationName)
    if (clip) mixer.clipAction(clip).play()
    return () => {
      mixer.stopAllAction()
    }
  }, [mixer, animations, animationName])

  // Fit the camera to whatever is visible whenever model or filter changes
  useEffect(() => {
    const box = new Box3().setFromObject(scene)
    if (box.isEmpty()) return
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3()).length() || 1
    const cam = camera as PerspectiveCamera
    cam.near = size / 1000
    cam.far = size * 10
    cam.position.copy(center).add(new Vector3(size * 0.5, size * 0.4, size * 0.7))
    cam.updateProjectionMatrix()
    const orbit = controls as { target?: Vector3; update?: () => void } | null
    if (orbit?.target && orbit.update) {
      orbit.target.copy(center)
      orbit.update()
    } else {
      cam.lookAt(center)
    }
  }, [scene, meshFilter, camera, controls])

  useFrame((_, delta) => mixer.update(delta))

  return <primitive object={scene} />
}

const IndexPage = () => {
  const [modelUrl, setModelUrl] = useState(MODELS[0]!.url)
  const [decoder, setDecoder] = useState<DecoderKind>('minidraco')
  const [meshFilter, setMeshFilter] = useState(ALL_MESHES)
  const [animationName, setAnimationName] = useState(NO_ANIMATION)

  const { gltf, error, parseMs, decodeMs, decodeCalls } = useDracoGltf(modelUrl, decoder)

  const meshNames = useMemo(() => (gltf ? collectMeshNames(gltf.scene) : []), [gltf])
  const animationNames = useMemo(() => (gltf ? gltf.animations.map(clip => clip.name) : []), [gltf])

  // Reset the filters and auto-play the first clip when a new model arrives
  useEffect(() => {
    setMeshFilter(ALL_MESHES)
    setAnimationName(animationNames[0] ?? NO_ANIMATION)
  }, [modelUrl, animationNames])

  return (
    <div className="relative h-full w-full bg-neutral-900">
      <Canvas camera={{ position: [2, 1.5, 3], fov: 50 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 10, 7]} intensity={2.4} />
        <directionalLight position={[-5, -2, -7]} intensity={0.6} />
        {gltf && (
          <Model
            key={`${modelUrl}:${decoder}`}
            scene={gltf.scene}
            animations={gltf.animations}
            meshFilter={meshFilter}
            animationName={animationName}
          />
        )}
        <OrbitControls makeDefault />
      </Canvas>

      <div className="absolute top-4 left-4 flex w-72 flex-col gap-3 rounded-xl bg-black/70 p-4 text-sm text-white backdrop-blur">
        <h1 className="text-base font-semibold">minidraco demo</h1>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">Model</span>
          <select className="rounded bg-neutral-800 p-2" value={modelUrl} onChange={e => setModelUrl(e.target.value)}>
            {MODELS.map(model => (
              <option key={model.url} value={model.url}>
                {model.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">Decoder</span>
          <select
            className="rounded bg-neutral-800 p-2"
            value={decoder}
            onChange={e => setDecoder(e.target.value as DecoderKind)}
          >
            {DECODER_KINDS.map(kind => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">Mesh (visual debugging)</span>
          <select
            className="rounded bg-neutral-800 p-2"
            value={meshFilter}
            onChange={e => setMeshFilter(e.target.value)}
          >
            <option value={ALL_MESHES}>All meshes ({meshNames.length})</option>
            {meshNames.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        {animationNames.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400">Animation</span>
            <select
              className="rounded bg-neutral-800 p-2"
              value={animationName}
              onChange={e => setAnimationName(e.target.value)}
            >
              <option value={NO_ANIMATION}>None</option>
              {animationNames.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="border-t border-neutral-700 pt-2 text-xs text-neutral-300">
          {error && <p className="text-red-400">{error}</p>}
          {!error && !gltf && <p>Loading…</p>}
          {gltf && (
            <>
              <p>
                GLTF parse: <span className="font-mono">{parseMs.toFixed(1)} ms</span>
              </p>
              <p>
                Draco decode: <span className="font-mono">{decodeMs.toFixed(1)} ms</span> ({decodeCalls}{' '}
                {decodeCalls === 1 ? 'primitive' : 'primitives'})
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default IndexPage

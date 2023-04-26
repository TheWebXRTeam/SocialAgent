import { library } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { faVrCardboard } from "@fortawesome/free-solid-svg-icons";
import { Box as ContainerBox } from "@mantine/core";
import { OrbitControls, Stats } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
	Controllers,
	Hands,
	XR,
	useXR
} from "@react-three/xr";
import * as THREE from "three";

import { Text } from "@react-three/drei";
import { RealityAccelerator } from "ratk";
import { RefObject, useEffect, useRef, useState } from "react";
import { BackSide, Mesh } from "three";
// import next/dynamic and dynamically load LoginForm instead
import dynamic from "next/dynamic";
const LoginForm = dynamic(() => import("../components/Login"), { ssr: false });

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
// import skeletonutils
import { clone } from "three/examples/jsm/utils/SkeletonUtils";
// import AR button from react three xr
import Layout from "../components/layouts/article";
import { useLocalStorage } from "../components/useLocalStorage";

library.add(faVrCardboard);

const loadTexture = async (url) => {
  try {
    const apiUrl = "/api/image-proxy";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: url }),
    });
    const jsonResponse = await response.json();
    const base64Image = jsonResponse.base64Image;
    const binaryImage = atob(base64Image.split(",")[1]);
    const arrayBuffer = new ArrayBuffer(binaryImage.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < binaryImage.length; i++) {
      uint8Array[i] = binaryImage.charCodeAt(i);
    }

    const blob = new Blob([uint8Array], { type: "image/jpeg" });
    const newUrl = URL.createObjectURL(blob);
    const newTexture = new THREE.TextureLoader().load(newUrl);

    return newTexture;
  } catch (error) {
    console.error("Error loading texture:", error);
  }
};

const useFeedDataTextures = (feedData) => {
  const [textures, setTextures] = useState([]);

  useEffect(() => {
    if (!feedData) return;

    const loadTextures = async () => {
      const texturesPromises = feedData.map((item) =>
        loadTexture(item?.post?.author.avatar)
      );

      const loadedTextures = await Promise.all(texturesPromises);
      setTextures(loadedTextures);
    };

    loadTextures();
  }, [feedData]);

  return textures;
};

const Balls = () => {
  const [feedData, setFeedData] = useLocalStorage("feedData", null);
  const textures = useFeedDataTextures(feedData);

  const { gl, scene, camera, xr } = useThree();

  const { session } = useXR();

  useEffect(() => {
	console.log('session', session);
	// add event listener for session
	if (session) {
		session.addEventListener('select', () => {
			console.log("something selected")
		});
	}

  }, [session]);
  
  const ratkObject = new RealityAccelerator(gl.xr);
  scene.add(ratkObject.root);

  useFrame((state, delta) => {
    ratkObject.update();
  });

  const radius = 0.08;

  const random = (min, max) => Math.random() * (max - min) + min;

  const groups = [];

  useFrame((state, delta) => {
    //GLOBAL tick update
    for (let i = 0; i < groups.length; i++) {
      let bf = groups[i];
      bf.update();
    }
  });

  // load a gltf file to be used as geometry
  const gltf = useLoader(GLTFLoader, "butterfly.glb");
  const pfp = useLoader(GLTFLoader, "profilepic.glb");
  const mixers = [];
  const clock = new THREE.Clock();

  const balls = !feedData
    ? []
    : feedData.map((item, i) => {
        const uniqueKey = `${item.post.author.displayName}-${i}`;

        const butterfly = clone(gltf.scene);

        // Clone animations and setup the mixer
        const mixer = new THREE.AnimationMixer(butterfly);
        mixers.push(mixer);

        if (gltf.animations && gltf.animations.length > 0) {
          gltf.animations.forEach((animation) => {
            mixer.clipAction(animation).play();
          });
        }

        //useframe to update the animation mixer
        useFrame((state, delta) => {
          mixer.update(delta);
        });

        const profilepic = pfp.scene.clone();

        butterfly.animations = gltf.animations;

        const groupRef = useRef(null) as any;

        useEffect(() => {
          if (!groupRef.current) return;
          groups.push(groupRef.current);
        }, []);

        profilepic.traverse((child) => {
          if (child instanceof Mesh) {
            child.material.color.setHex(Math.random() * 0xffffff);
          }
        });

        // randomize the color of the butterfly
        butterfly.traverse((child) => {
          if (child instanceof Mesh) {
            child.material.color.setHex(Math.random() * 0xffffff);
          }
        });
        const likeCount = item?.post?.likeCount;
        const pfpGeometry = (profilepic.children[0] as Mesh).geometry;

        const base64Texture = textures[i];

        return (
          <group
            key={uniqueKey}
            position={[random(-2, 2), random(0.1, 1), random(-2, 2)]}
          >
            {/* add cube to the scene */}
            <primitive
              key={`${uniqueKey}-primitive`}
              scale={[0.08, 0.08, 0.08]}
              position={[0, 0, 0]}
              object={butterfly}
            />
            {!base64Texture ? null : (
              <>
                {/* @ts-ignore */}
                <Text
                  key={`${uniqueKey}-text1`}
                  position={[0.3, 0, 0]}
                  fontSize={0.03}
                  maxWidth={1}
                  lineHeight={1}
                  letterSpacing={0.02}
                  anchorX={2.3}
                  // @ts-ignore
                  wrap={0.1}
                  height={0.1}
                  color={0x000000}
                  textAlign={"left"}
                >
                  {item?.post?.author?.displayName +
                    ": " +
                    item.post.record.text}
                </Text>
                <Text
                  key={`${uniqueKey}-text2`}
                  position={[2, 0, 0]}
                  fontSize={0.03}
                  maxWidth={0.5}
                  lineHeight={1}
                  letterSpacing={0.02}
                  anchorX={2.3}
                  // @ts-ignore
                  wrap={0.1}
                  height={0.1}
                  color={0x000000}
                  textAlign={"center"}
                >
                  {likeCount + "\n" + (likeCount === 1 ? "like" : "likes")}
                </Text>
                <mesh
                  geometry={pfpGeometry}
                  scale={[0.07, 0.07, 0.07]}
                  position={[0, 0, 0.04]}
                >
                  <meshStandardMaterial
                    side={THREE.DoubleSide}
                    map={base64Texture}
                  />
                </mesh>
              </>
            )}
          </group>
        );
      });

  return <>{balls}</>;
};

const App = () => {
	const [sessionData, setSessionData] = useState(null);
  return (
    <Layout title="Skyline">
        <LoginForm />
        <Canvas
          style={{
            position: "absolute",
            zIndex: 9999,
          }}
          camera={{
            fov: 50,
            near: 0.1,
            far: 100,
            position: [0, 1.6, 3],
          }}
          gl={{ antialias: true }}
        >
          <XR referenceSpace="local"
		  	onSessionStart={(event) => {
			setSessionData(true);
		}}
		  >
            <Hands />
            <Controllers />
            <directionalLight position={[1, 1, 1]} color={0xffffff} />
			{sessionData && 
            <Balls />
			}
          </XR>
        </Canvas>
    </Layout>
  );
};

export default App;

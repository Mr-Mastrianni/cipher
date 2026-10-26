"use client";

import dynamic from "next/dynamic";

import type { SkyPosition } from "../engine/space";
import type { MemberChart } from "../state";
import type { Viewer } from "./Landing";
import "./world.css";

/**
 * The WebGL boundary.
 *
 * `three`, the post chain and the whole procedural world are heavy, and they
 * cannot be server-rendered: the engine needs a canvas, an audio context and a
 * pointer. Loading the experience only in the browser keeps the 2D site's server
 * render untouched and lets the route stream a useful loading frame.
 */
const WorldExperience = dynamic(
  () => import("./WorldExperience").then((module) => module.WorldExperience),
  {
    ssr: false,
    loading: () => (
      <div className="world-boot">
        <div className="world-boot-mark" aria-hidden="true" />
        <p>Opening the Cipher</p>
        <span>the valley, the chart and the wheel</span>
      </div>
    ),
  },
);

export function WorldMount({
  sky,
  chart,
  viewer,
}: {
  sky: SkyPosition[];
  chart: MemberChart | null;
  viewer: Viewer;
}) {
  return <WorldExperience sky={sky} chart={chart} viewer={viewer} />;
}

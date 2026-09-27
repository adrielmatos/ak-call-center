"use client";
import {usePathname} from "next/navigation";
import DeskcommParity from "./deskcomm-parity";
export default function DeskcommParitySurface(){return usePathname()==="/"?<DeskcommParity/>:null}

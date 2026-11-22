import type { Metadata } from "next";
import { Header } from "@/components/header";
import { MediaStudio } from "@/components/media-studio";
export const metadata: Metadata={title:"Video studio"};
export default async function EditPage({params}:{params:Promise<{videoId:string}>}){
  const {videoId}=await params;
  return <><Header/><MediaStudio videoId={videoId}/></>;
}

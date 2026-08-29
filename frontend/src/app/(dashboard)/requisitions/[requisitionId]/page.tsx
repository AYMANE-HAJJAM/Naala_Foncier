import { RequisitionDetailPage } from "@/features/requisitions/requisition-detail-page";
export default async function Page({params}:{params:Promise<{requisitionId:string}>}){const {requisitionId}=await params;return <RequisitionDetailPage id={requisitionId}/>}

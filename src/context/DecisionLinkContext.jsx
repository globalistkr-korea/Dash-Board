/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { isAllowedReportUser, loadAllowedReportEmails } from '../lib/reportNotesStore';
import { analysisIssueId } from '../lib/analysisDecision';
const Context=createContext(null);
const PENDING='vn-analysis-pending-v1';
function pendingDraft(){try{return JSON.parse(sessionStorage.getItem(PENDING));}catch{return null;}}
export function DecisionLinkProvider({children,onNavigate}) {
  const [state,setState]=useState({user:undefined,allowed:null,items:[],ready:false,error:''});
  const [pending,setPending]=useState(pendingDraft);
  useEffect(()=>onAuthStateChanged(auth,user=>{
    setState({user,allowed:null,items:[],ready:false,error:''});
    if(user)loadAllowedReportEmails().then(allowed=>setState(s=>s.user?.uid===user.uid?{...s,allowed}:s));
  }),[]);
  const permitted=isAllowedReportUser(state.user,state.allowed||[]);
  useEffect(()=>{
    if(!permitted)return;
    return onSnapshot(collection(db,'decisionBoards',state.user.uid,'items'),{includeMetadataChanges:true},snap=>setState(s=>({...s,items:snap.docs.map(d=>({...d.data(),id:d.id})),ready:true,error:'',cached:snap.metadata.fromCache})),()=>setState(s=>({...s,ready:false,error:'클라우드 연결을 확인해주세요.'})));
  },[permitted,state.user?.uid]);
  async function openAnalysis(payload) {
    const id=await analysisIssueId(payload.sourceKey);
    const value={...payload,id};
    try{sessionStorage.setItem(PENDING,JSON.stringify(value));}catch{/* kept in memory */}
    setPending(value);onNavigate('decision');
  }
  function consumePending(){try{sessionStorage.removeItem(PENDING);}catch{/* kept in memory */}setPending(null);}
  return <Context.Provider value={{...state,permitted,pending,openAnalysis,consumePending}}>{children}</Context.Provider>;
}
export const useDecisionLinks=()=>useContext(Context);

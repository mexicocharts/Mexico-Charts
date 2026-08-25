import { View,Text,StyleSheet,ScrollView } from "react-native";
import { useTouringIntelligence } from "@/hooks/useTouringIntelligence";

const typeLabel={tour:"Gira",festival:"Festival",residency:"Residencia",standalone:"Fecha individual"};
const confidenceLabel=(value:string|null|undefined)=>value==="high"?"ALTA":value==="medium"?"MEDIA":value==="limited"?"LIMITADA":"NO DISPONIBLE";
const money=(value:number)=>`USD ${Math.round(value).toLocaleString("en-US")}`;

export default function TouringIntelligencePanel(){
  const{data,isLoading}=useTouringIntelligence();
  if(isLoading)return <Text style={styles.empty}>Cargando Touring Lab…</Text>;
  if(!data?.tours.length)return <Text style={styles.empty}>Esperando observaciones autorizadas.</Text>;
  const attention=data.operations?.attention;
  return <View style={styles.section}>
    <View style={styles.header}><Text style={styles.title}>TOURING LAB</Text><Text style={styles.meta}>{new Date(data.generatedAt).toLocaleDateString("es-MX")}</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>
      {data.tours.slice(0,10).map(tour=><View key={tour.artistId} style={styles.card}>
        <Text style={styles.type}>{typeLabel[tour.appearanceType]}</Text><Text style={styles.artist} numberOfLines={2}>{tour.artistName.toUpperCase()}</Text>
        <Text style={styles.tour} numberOfLines={2}>{tour.tourName}</Text>
        <View style={styles.stats}><View><Text style={styles.number}>{tour.concertCount}</Text><Text style={styles.label}>FECHAS</Text></View><View><Text style={styles.number}>{tour.demandScore}</Text><Text style={styles.label}>DEMANDA · {tour.demandConfidence.toUpperCase()}</Text></View></View>
        <Text style={styles.note}>Señal estimada · no representa ventas</Text>
      </View>)}
    </ScrollView>
    {attention&&<View style={styles.operations}>
      <Text style={styles.subheading}>ATENCIÓN OPERATIVA</Text>
      <View style={styles.attentionGrid}>
        <Metric label="CAPACIDAD" value={attention.missing_capacity}/><Metric label="MONEDA" value={attention.missing_currency}/>
        <Metric label="AGRUPACIÓN" value={attention.missing_tour_grouping}/><Metric label="CONFIANZA BAJA" value={attention.low_confidence}/>
      </View>
      {data.operations?.reviewQueue.length ? <Text style={styles.review}>REVISIÓN AUTORIZADA · {data.operations.reviewQueue.length} ITEM{data.operations.reviewQueue.length===1?"":"S"}</Text> : null}
    </View>}
    {!!data.comparisons?.length&&<View style={styles.comparisons}>
      <Text style={styles.subheading}>COMPARATIVAS DE GIRA</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.comparisonTrack}>
        {data.comparisons.slice(0,12).map((comparison,index)=><View key={`${comparison.artist_id}-${comparison.market}-${index}`} style={styles.comparisonCard}>
          <Text style={styles.artistSmall} numberOfLines={1}>{comparison.artist_name.toUpperCase()}</Text>
          <Text style={styles.comparisonMeta}>{comparison.market||"Mercado no publicado"} · {comparison.venue_scale}</Text>
          <Text style={styles.comparisonNumber}>{comparison.shows} FECHA{comparison.shows===1?"":"S"}</Text>
          <Text style={styles.gross}>{comparison.estimated_gross_usd!=null?money(comparison.estimated_gross_usd):"Gross no estimable"}</Text>
          <Text style={styles.confidence}>CONFIANZA · {confidenceLabel(comparison.confidence)}</Text>
          <Text style={styles.note}>Estimación orientativa · no representa boletos vendidos</Text>
        </View>)}
      </ScrollView>
    </View>}
  </View>
}

function Metric({label,value}:{label:string;value:number}){return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.label}>{label}</Text></View>}

const styles=StyleSheet.create({
  section:{marginTop:28},header:{paddingHorizontal:20,marginBottom:12,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},title:{color:"#fff",fontWeight:"900",fontSize:16,letterSpacing:1.5},meta:{color:"#52525b",fontSize:10},
  track:{paddingHorizontal:20,gap:10},card:{width:220,minHeight:180,borderWidth:1,borderColor:"#202020",backgroundColor:"#0b0b0b",padding:16},type:{color:"#39FF14",fontSize:9,fontWeight:"900",letterSpacing:1.5},artist:{color:"#fff",fontSize:20,fontWeight:"900",marginTop:10},tour:{color:"#71717a",fontSize:11,lineHeight:16,marginTop:5,minHeight:32},stats:{flexDirection:"row",gap:24,marginTop:15},number:{color:"#fff",fontSize:20,fontWeight:"900"},label:{color:"#52525b",fontSize:7,fontWeight:"800",marginTop:2},note:{color:"#3f3f46",fontSize:8,marginTop:13,textTransform:"uppercase"},empty:{color:"#52525b",paddingHorizontal:20,paddingVertical:24,fontSize:11},
  operations:{marginTop:22,marginHorizontal:20,borderTopWidth:1,borderTopColor:"#202020",paddingTop:14},subheading:{color:"#fff",fontSize:10,fontWeight:"900",letterSpacing:1.5,marginBottom:10},attentionGrid:{flexDirection:"row",justifyContent:"space-between"},metric:{minWidth:65},metricValue:{color:"#fff",fontSize:20,fontWeight:"900"},review:{color:"#39FF14",fontSize:8,fontWeight:"900",letterSpacing:1.2,marginTop:12},
  comparisons:{marginTop:22},comparisonTrack:{paddingHorizontal:20,gap:10},comparisonCard:{width:215,minHeight:145,borderWidth:1,borderColor:"#202020",backgroundColor:"#0b0b0b",padding:14},artistSmall:{color:"#fff",fontSize:13,fontWeight:"900"},comparisonMeta:{color:"#71717a",fontSize:9,marginTop:7},comparisonNumber:{color:"#39FF14",fontSize:11,fontWeight:"900",marginTop:12},gross:{color:"#fff",fontSize:16,fontWeight:"900",marginTop:7},confidence:{color:"#a1a1aa",fontSize:8,fontWeight:"800",marginTop:5,letterSpacing:.7}
});

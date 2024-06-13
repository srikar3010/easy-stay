import CustomImage from "./CustomImage";
function PlaceImg({place,index=0,className=null}) {
  if (!place.photos?.length) {
    return '';
  }
  if (!className) {
    className = 'object-cover';
  }
  return (
    <CustomImage className={className} src={place.photos[index]} alt=""/>
  );
}

export default PlaceImg
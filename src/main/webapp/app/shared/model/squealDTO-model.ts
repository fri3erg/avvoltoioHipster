import { IGeolocationCoordinates } from 'app/entities/geolocation-coordinates/geolocation-coordinates.model';
import { ISquealCat } from 'app/entities/squeal-cat/squeal-cat.model';
import { ISquealViews } from 'app/entities/squeal-views/squeal-views.model';
import { ISqueal } from 'app/entities/squeal/squeal.model';

export interface ISquealDTO {
  squeal?: ISqueal;
  category?: ISquealCat;
  reactions?: IReactionDTO[];
  views?: ISquealViews;
  userName?: string;
  userImg?: string;
  userContentType?: string;
  active_reaction?: string | null | undefined;
  geoLoc?: IGeolocationCoordinates;
}
export interface IDirectDTO {
  user?: string;
  body?: string;
}
export interface IReactionDTO {
  reaction: string;
  number: number;
  user: boolean;
}

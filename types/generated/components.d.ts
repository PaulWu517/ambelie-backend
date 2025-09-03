import type { Schema, Struct } from '@strapi/strapi';

export interface ShowroomSpace extends Struct.ComponentSchema {
  collectionName: 'components_showroom_spaces';
  info: {
    description: 'A space/section within a showroom, with title, subtitle, description and images';
    displayName: 'space';
  };
  attributes: {
    description: Schema.Attribute.Text;
    images: Schema.Attribute.Media<'images', true>;
    subtitle: Schema.Attribute.String;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'showroom.space': ShowroomSpace;
    }
  }
}

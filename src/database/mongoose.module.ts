import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const uri = config.get<string>('mongo.uri');
        if (!uri) throw new Error('MONGO_URI is missing');
        return { uri };
      },
    }),
  ],
  exports: [MongooseModule],
})
export class MongooseDatabaseModule {}
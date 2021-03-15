# Pestras Micro Kafka

Pestras microservice plugin for akafka messaging support.

## install

```bash
npm i @pestras/micro @pestras/micro-kafka
```

## Plug In

```ts
import { SERVICE, Micro } from '@pestras/micro';
import { MicroKafka } from '@pestras/micro-kafka;

Micro.plugin(new Microakafka(config));

@SERVICE()
class test {}

Micro.start(Test);
```

### MicroKafka Parameters:

Name              | Type              | Default       | Description
kafkaConfig       | KafkaConfig       | Required      | see [KafkaJs Client](https://kafka.js.org/docs/configuration)
consumerConfig    | ConsumerConfig    | null          | see [KafkaJs Consumer](https://kafka.js.org/docs/consuming#a-name-options-a-options)
ConsumerRunConfig | ConsumerRunConfig | null          | see [KafkaJs Consumer](https://kafka.js.org/docs/consuming)

## Consumer:

Micro-kafka helps us consume topics by using **TOPIC** Decorator just like the following

```ts
import { SERVICE, Micro } from '@pestras/micro';
import { MicroKafka, TOPIC, EachMessagePayload } from '@pestras/micro-kafka;

let kafka = new Microakafka(config);
Micro.plugin(kafka);

@SERVICE()
class test implements MicroKafkaEvents {

  @TOPIC("topicName", { subscribeOptions: { fromBeginning: true } })
  topicHandler(data: EachMessagePayload) {
    // our code
  }
}

Micro.start(test);
```

We can run multiple hooks before handling the topic.

```ts
@SERVICE()
class test implements MicroKafkaEvents {

  // hooks can be async
  async auth(data: EachMessageData, handlerName: string) {
    // some code

    // returning false will terminate the workflow
    return true;
  }

  validate(data: EachMessageData, handlerName: string) {
    // validation code
    return true;
  }

  @TOPIC("topicName", {
    hooks: ["auth", "vallidate"]
    subscribeOptions: { fromBeginning: true }
  })
  topicHandler(data: EachMessagePayload) {
    // our code
  }
}
```

Hooks must return or resolve (async) to true on success or false on failure.

### Multible Topics

Multible topics can be used on the same handler.

```ts
@SERVICE()
class test implements MicroKafkaEvents {

  @TOPIC("topicName", { subscribeOptions: { fromBeginning: true } })
  @TOPIC("otherTopic")
  topicHandler(data: EachMessagePayload) {
    // our code
  }
}

Micro.start(test);
```

# Sub Services

```ts
// comments.service.ts
import { TOPIC } from '@pestras/micro-nats';
import { Client, Payload} from 'ts-nats';

export class Comments {
  
  validate(data: EachMessagePayload, handlerName: string) { return true }
  
  @TOPIC('newComment', {
    // auth hook from the main service
    // validate hook from the local service (sub service)
    hooks: ['auth', 'validate']
  })
  create(data: EachMessagePayload) {
    
  }
}
```

```ts
// main.ts

Micro.plugin(new MicroNats());

@SERVICE()
class Articles {

  onInit() {    
    Micro.store.someSharedValue = "shared value";
  }
  
  async auth(data: EachMessagePayload, handlerName: string) {
    return true;
  }
  
  validate(data: EachMessagePayload, handlerName: string) {
    return true;
  }

  @TOPIC('newArticle', {
    // both hooks from the main service
    hooks: ['auth', 'validate']
  })
  create(data: EachMessagePayload) {
    
  }
}

// pass sub services as an array to the second argument of Micro.start method
Micro.start(Articles, [Comments]);
```

* Local hooks has the priority over main service hooks.
* Subservices have their own lifecycle events.

## Create Producer:

By default ** micro-kafka** does not create producer unless we ask for it.

```ts
import { SERVICE, Micro } from '@pestras/micro';
import { MicroKafka, MicroKafkaEvents, TOPIC, EachMessagePayload } from '@pestras/micro-kafka;

let kafka = new Microakafka(config);
kafka.createProducer(consumerConfig);

Micro.plugin(kafka);


@SERVICE()
class test implements MicroKafkaEvents {

  @TOPIC('newArticle', {
    // both hooks from the main service
    hooks: ['auth', 'validate']
  })
  create(data: EachMessagePayload) {
    // kafka.producer.send(...)
  }
}

Micro.start(Test);
```

## lifecycle Events

### onCunsomerConnected:

Called when kafka consumer is connected successfully

```ts
import { SERVICE, Micro } from '@pestras/micro';
import { MicroKafka, MicroKafkaEvents } from '@pestras/micro-kafka;

let kafka = new Microakafka(config);

Micro.plugin(kafka);


@SERVICE()
class test implements MicroKafkaEvents {

  onCunsomerConnected() {}
}
```

### onProducerConnected:

Called when kafka consumer is connected successfully

```ts
import { SERVICE, Micro } from '@pestras/micro';
import { MicroKafka, MicroKafkaEvents, Producer } from '@pestras/micro-kafka;

let kafka = new Microakafka(config);
kafka.createProducer(producerConfig);
Micro.plugin(kafka);


@SERVICE()
class test implements MicroKafkaEvents {

  onProducerConnected(producer: Producer) {

  }
}
```

Thank you.
import { HealthState, Micro, MicroPlugin } from "@pestras/micro";
import { Consumer, ConsumerConfig, ConsumerRunConfig, ConsumerSubscribeTopic, Kafka, KafkaConfig, Producer, ProducerConfig } from "kafkajs";

export interface MicroKafkaEvents {
  onCunsomerConnected?: () => void;
  onProducerConnected?: (producer: Producer) => void;
}

export interface Topic {
  hooks?: string[];
  subscribeOptions: Omit<ConsumerSubscribeTopic, "topic">;
}

export interface TopicConfig extends Topic {
  key?: string;
  service?: any;
}

let serviceTopics: { [key: string]: TopicConfig } = {};

export function TOPIC(name: string, options: Topic) {
  return (target: any, key: string) => {
    serviceTopics[name] = {
      hooks: options.hooks || [],
      subscribeOptions: options.subscribeOptions || {},
      key,
      service: target.constructor
    };
  }
}

export class MicroKafka extends MicroPlugin implements HealthState {
  private _kafka: Kafka;
  private _consumer: Consumer;
  private _createProducer = false;
  private _producerConfig: ProducerConfig;
  private _producer: Producer;

  healthy = false;
  ready = false;
  live = false;

  constructor(
    private _config: KafkaConfig,
    private _consumerConfig?: ConsumerConfig,
    private _consumerRunConfig?: Omit<ConsumerRunConfig, "eachMessage" & "eachBatch">) {
    super();
  }

  private async _initConsumers() {
    this._consumer = this._kafka.consumer(this._consumerConfig);

    try {
      await this._consumer.connect();
    } catch (e) {
      Micro.logger.error("error connecting consumer", e?.message || e);
      throw e;
    }

    for (let topicName in serviceTopics) {
      let topic = serviceTopics[topicName];

      if (typeof Micro.service[topic.key] !== "function") continue;

      Micro.logger.info('subscribing to topic: ' + topicName);
      await this._consumer.subscribe({ topic: topicName, ...topic.subscribeOptions });
    }

    await this._consumer.run({
      eachMessage: async data => {
        let topicName = data.topic;
        let topic = serviceTopics[topicName];
        let currentService = Micro.getCurrentService(topic.service) || Micro.service;

        if (topic.hooks.length > 0) {
          let currentHook: string;

          try {
            for (let hook of topic.hooks) {
              currentHook = hook;

              if (currentService[hook] === undefined && Micro.service[hook] === undefined)
                return Micro.logger.warn(`Hook not found: '${hook}'!`);

              if (typeof currentService[hook] !== "function" && typeof Micro.service[hook] !== "function")
                return Micro.logger.warn(`invalid hook type: '${hook}'!`);

              let ret = currentService[hook]
                ? currentService[hook](data, topic.key)
                : Micro.service[hook](data, topic.key);

              if (ret) {
                if (typeof ret.then === "function") {
                  let passed = await ret;
                  if (!passed)
                    return Micro.logger.info(`topic '${topicName}' ended from hook: '${hook}'`);
                }
              } else {
                return Micro.logger.info(`topic '${topicName}' ended from hook: '${hook}'`);
              }
            }
          } catch (e) {
            return Micro.logger.error(`error in hook "${currentHook}"`, e?.message || e);
          }

          try {
            let ret = currentService[topic.key](data);
            if (ret && typeof ret.then === "function")
              await ret;

            Micro.logger.info(`topic '${topicName}' ended`);
          } catch (e) {
            Micro.logger.error(`error in topic '${topicName}' handler '${topic.key}`, e?.message || e);
          }
        }
      },
      ...this._consumerRunConfig
    });
  }

  async init() {
    try {
      this._kafka = new Kafka(this._config);
    } catch (e) {
      Micro.logger.error("error configuring kafka", e?.message || e);
      throw e;
    }

    if (Object.keys(serviceTopics).length > 0) {
      await this._initConsumers();

      if (typeof Micro.service.onConsumerConnected === "function")
        Micro.service.onConsumerConnected();
    }


    if (this._createProducer) {
      this._producer = this._kafka.producer(this._producerConfig);
      await this._producer.connect();

      if (typeof Micro.service.onProducerConnected === "function")
        Micro.service.onProducerConnected(this.producer);
    }

    this.healthy = true;
    this.ready = true;
    this.live = true;
  }

  public get producer() { return this._producer; }

  public async createProducer(config?: ProducerConfig) {
    this._producerConfig = config;
    this._createProducer = true;
  }
}
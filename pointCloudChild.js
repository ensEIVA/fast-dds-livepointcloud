/* eslint-disable prettier/prettier */
// Import native addons using dynamic import with the createRequire method
// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);

// Import the native addons using require
const fastdds = require('./fastdds.node');
const pointCloudPackage = require('./pointcloud.node');

console.log(fastdds);
console.log(pointCloudPackage);
const TOPIC = 'TVL-PREC7670/LivePointCloudTest';

let participant = null;
let terminateCondition = null;
let dataReader = null;
let waitSet = null;
// console.log('PointCloud: ', pointCloudPackage);
initSubscriber();
run();

function initSubscriber() {
  
  console.log('Starting subscriber...');
  const factory = fastdds.DomainParticipantFactory.get_instance();
  console.log('factory: ', factory);

  participant = factory.create_participant_with_default_profile(null, fastdds.StatusMask.none());
  if (participant == null) {
    console.log('Error creating participant');
    return;
  }
  
  // Create the subscriber
  const subQos = new fastdds.SubscriberQos();
  const subscriber = participant.create_subscriber(subQos, null, fastdds.StatusMask.none());

  // Register the type
  const type = new fastdds.TypeSupport(new pointCloudPackage.PointCloudPubSubType());
  type.register_type(participant);

  // Create the topic
  const topicQos = participant.get_default_topic_qos();
  const topic = participant.create_topic(TOPIC, type.get_type_name(), topicQos);

  // Create the reader
  const readerQos = new fastdds.DataReaderQos();
  dataReader = subscriber.create_datareader(topic, readerQos, null, fastdds.StatusMask.all());

  // Waitset
  terminateCondition = new fastdds.GuardCondition();

  waitSet = new fastdds.WaitSet();
  waitSet.attach_condition(dataReader.get_statuscondition());
  waitSet.attach_condition(terminateCondition);
  console.log('Subscriber initialized.');
}

async function run() {
  let pointCloud = new pointCloudPackage.PointCloud();

  console.log('Running subscriber...');
  while (true) {
    const triggered_conditions = new fastdds.ConditionSeq();
    const ret_code = waitSet.wait(triggered_conditions, fastdds.c_TimeInfinite);
    if (fastdds.RETCODE_OK != ret_code) {
      process.send('Error waiting for conditions');
    }

    for (let i = 0; i < triggered_conditions.size(); i++) {
      const cond = triggered_conditions.get(i);
      if (cond) {
        const status_cond = fastdds.Condition.as_StatusConditions(cond);
        if (status_cond && dataReader) {
          const entity = status_cond.get_entity();
          const changed_statuses = entity.get_status_changes();
          if (changed_statuses?.is_active(fastdds.StatusMask.subscription_matched())) {
            const status_ = new fastdds.SubscriptionMatchedStatus();
            dataReader.get_subscription_matched_status(status_);
            if (status_.current_count_change == 1) {
              process.send(`DataReader matched with publisher.`);
            } else if (status_.current_count_change == -1) {
              process.send(`DataReader unmatched with publisher.`);
            } else {
              process.send(
                status_.current_count_change +
                  ' is not a valid value for SubscriptionMatchedStatus current count change'
              );
            }
          }

          if (changed_statuses.is_active(fastdds.StatusMask.requested_deadline_missed())) {
            const deadlineStatus = new fastdds.DeadlineMissedStatus();
            dataReader.get_requested_deadline_missed_status(deadlineStatus);
            if (deadlineStatus.total_count_change > 0) {
              process.send(`DataReader detects deadline missed.`);
            }
          }

          if (changed_statuses.is_active(fastdds.StatusMask.liveliness_changed())) {
            const livelinessStatus = new fastdds.LivelinessChangedStatus();
            dataReader.get_liveliness_changed_status(livelinessStatus);
            if (0 < livelinessStatus.alive_count_change) {
              process.send(`DataReader detects liveliness recovered.`);
            }

            if (0 < livelinessStatus.not_alive_count_change) {
              process.send(`DataReader detects liveliness lost.`);
            }
          }

          if (changed_statuses.is_active(fastdds.StatusMask.requested_incompatible_qos())) {
            const offeredStatus = new fastdds.OfferedIncompatibleQosStatus();
            dataReader.get_requested_incompatible_qos_status(offeredStatus);
            process.send(`DataReader requested incompatible QoS `);
          }

          if (changed_statuses?.is_active(fastdds.StatusMask.data_available())) {
            const info = new fastdds.SampleInfo();
            while (fastdds.RETCODE_OK == dataReader.take_next_sample(pointCloud, info)) {
              if (info.instance_state == fastdds.ALIVE_INSTANCE_STATE && info.valid_data) {
                processPointCloud(pointCloud);
              }
            }
          }
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 10)); // ms
  }
}

function getFieldOffset(fields, labelEnum) {
  for (let i = 0; i < fields.size(); i++) {
    const field = fields.get(i);
    if (field.format && field.format() === labelEnum) {
      return {
        offset: field.offset(),
        datatype: field.datatype()
      };
    }
  }
  throw new Error(`Field with format ${labelEnum} not found`);
}

function readValue(buffer, offset, datatype) {
  switch (datatype) {
    case 1:
      return buffer.readInt8(offset); // INT8
    case 2:
      return buffer.readUInt8(offset); // UINT8
    case 3:
      return buffer.readInt16LE(offset); // INT16
    case 4:
      return buffer.readUInt16LE(offset); // UINT16
    case 5:
      return buffer.readInt32LE(offset); // INT32
    case 6:
      return buffer.readUInt32LE(offset); // UINT32
    case 7:
      return buffer.readFloatLE(offset); // FLOAT32
    case 8:
      return buffer.readDoubleLE(offset); // FLOAT64
    default:
      return null;
  }
}

let lastProcessedTime = 0;
const PROCESS_INTERVAL_MS = 1000; // 1 second
function processPointCloud(pointCloud) {
  // console.log('Processing point cloud...');
  // const now = Date.now()
  // if (now - lastProcessedTime < PROCESS_INTERVAL_MS) {
  //   return // skip this one
  // }
  // lastProcessedTime = now

  const pointStep = pointCloud.point_step();

  // data
  const data = pointCloud.data();
  const size = data.size();
  const fields = pointCloud.fields();
  const rawData = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    rawData[i] = data.get(i);
  }
  const buffer = Buffer.from(rawData.buffer);
  const numPoints = Math.floor(buffer.length / pointStep); // calculate number of points

  const FORMAT_X = 1;
  const FORMAT_Y = 2;
  const FORMAT_Z = 3;
  const FORMAT_RGB = 8;

  const fieldX = getFieldOffset(fields, FORMAT_X);
  const fieldY = getFieldOffset(fields, FORMAT_Y);
  const fieldZ = getFieldOffset(fields, FORMAT_Z);
  const fieldR = getFieldOffset(fields, FORMAT_RGB);
  const fieldG = getFieldOffset(fields, FORMAT_RGB);
  const fieldB = getFieldOffset(fields, FORMAT_RGB);

  const points = new Array(numPoints);

  for (let i = 0; i < numPoints; i++) {
    const offset = i * pointStep;

    const x = readValue(buffer, offset + fieldX.offset, fieldX.datatype);
    const y = readValue(buffer, offset + fieldY.offset, fieldY.datatype);
    const z = readValue(buffer, offset + fieldZ.offset, fieldZ.datatype);

    const r = readValue(buffer, offset + fieldR.offset, fieldR.datatype);
    const g = readValue(buffer, offset + fieldG.offset + 8, fieldG.datatype);
    const b = readValue(buffer, offset + fieldB.offset + 16, fieldB.datatype);

    points[i] = { x, y, z, r, g, b };
  }

  process.send([points]);
}

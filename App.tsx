import React, {useState, useEffect, useMemo, useContext} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  Button,
  Keyboard,
  TouchableOpacity,
  TextInput,
  FlatList,
} from 'react-native';

import {Header, Colors} from 'react-native/Libraries/NewAppScreen';

interface MeetingParticipantType {
  id: string;
  name: string;
  status: string;
  user: {
    id: string;
  };
}

interface OfflineParticipantsToRemoveType {
  userId: string;
  timestamp: number;
  remove: boolean;
}

interface ParticipantInterface {
  identity: string;
}

interface TwilioParticipant extends ParticipantInterface {
  sid: string;
}

interface OfflineParticipant extends ParticipantInterface {}
type VideoParticipant = TwilioParticipant | OfflineParticipant;

const statusToRemoveParticipant = [
  'HANGUP',
  'KICKED',
  'NO_ANSWER',
  'COMPLETED',
];

const TIMEOUT_TO_SHOW_STATUS = 2000;

const App = () => {
  const user = {identity: '3', sid: 'sid_3'};
  const initialData = {
    meeting: {
      participants: [
        {id: '1', name: 'pirmas', status: 'HANGUP', user: {id: '1'}},
        {id: '2', name: 'antras', status: 'IN_CALL', user: {id: '2'}},
        {id: '3', name: 'trecias', status: 'IN_CALL', user: {id: '3'}},
      ],
    },
  };

  const [data, setData] = useState(initialData);
  const [connectingUser, setConnectingUser] = useState<string>('');
  const [twilioParticipants, setTwilioParticipants] = useState<
    TwilioParticipant[]
  >([]);
  const [removedParticipants, setRemovedParticipants] = useState<string[]>([]);
  const [
    offlineParticipantsToRemove,
    setOfflineParticipantsToRemove,
  ] = useState<OfflineParticipantsToRemoveType[]>([]);

  // todo: remove in app
  useEffect(() => {
    if (!twilioParticipants.find((v) => v.identity === user.identity)) {
      onRoomParticipantDidConnect(user);
    }
  }, []);

  useEffect(() => {
    if (offlineParticipantsToRemove.length) {
      const latestParticipant: OfflineParticipantsToRemoveType = offlineParticipantsToRemove.reduce(
        (a, b) => (a.timestamp < b.timestamp ? a : b),
      );

      const timeOut = setTimeout(() => {
        const changedParticipantsList = changeRemoveStatusForWaitingParticipant(
          latestParticipant.userId,
        );
        setOfflineParticipantsToRemove(changedParticipantsList);
      }, TIMEOUT_TO_SHOW_STATUS);

      return () => {
        clearTimeout(timeOut);
      };
    }

    return () => {};
  }, [offlineParticipantsToRemove]);

  const findInOfflineParticipantsToRemoveList = (userId: string) =>
    offlineParticipantsToRemove.find(
      (v: OfflineParticipantsToRemoveType) => v.userId === userId,
    );

  const changeRemoveStatusForWaitingParticipant = (userId: string) =>
    offlineParticipantsToRemove.map(
      (offlineParticipantToRemove: OfflineParticipantsToRemoveType) => {
        if (offlineParticipantToRemove.userId === userId) {
          offlineParticipantToRemove.remove = true;
          offlineParticipantToRemove.timestamp = new Date().getTime();
        }

        return offlineParticipantToRemove;
      },
    );

  const addToParticipantsToRemoveList = (userId: string) =>
    setOfflineParticipantsToRemove([
      ...offlineParticipantsToRemove,
      {
        remove: false,
        timestamp: new Date().getTime(),
        userId,
      },
    ]);

  const removeFromParticipantsToRemoveList = (userId: string) =>
    setOfflineParticipantsToRemove(
      offlineParticipantsToRemove.filter(
        (v: OfflineParticipantsToRemoveType) => v.userId !== userId,
      ),
    );

  const addToRemovedList = (userId: string) =>
    setRemovedParticipants([...removedParticipants, userId]);

  const findInRemovedParticipantsList = (userId: string) =>
    removedParticipants.find((v: string) => v === userId);

  const mapOfflineParticipants = (participant: MeetingParticipantType) => {
    const participantInRemoveList = findInOfflineParticipantsToRemoveList(
      participant.user.id,
    );

    if (participantInRemoveList) {
      if (participantInRemoveList.remove) {
        removeFromParticipantsToRemoveList(participant.user.id);
        addToRemovedList(participant.user.id);

        return null;
      }

      return {
        identity: participant.user.id,
      };
    }

    if (user && user.identity === participant.user.id) {
      return null;
    }

    if (findInRemovedParticipantsList(participant.user.id)) {
      return null;
    }

    if (statusToRemoveParticipant.includes(participant.status)) {
      addToParticipantsToRemoveList(participant.user.id);
    }

    return {
      identity: participant.user.id,
    };
  };

  const offlineParticipants = useMemo(() => {
    if (data) {
      const participants = data.meeting.participants.filter(
        (p: MeetingParticipantType) =>
          !twilioParticipants.find((v) => v.identity === p.user.id),
      );

      return participants.map(mapOfflineParticipants).filter((v) => v);
    }

    return [];
  }, [twilioParticipants, data, offlineParticipantsToRemove]);

  const onRoomParticipantDidConnect = (participant: TwilioParticipant) => {
    console.log('onRoomParticipantDidConnect: ', participant);

    setTwilioParticipants([...twilioParticipants, participant]);
    removeFromParticipantsToRemoveList(participant.identity);
    setRemovedParticipants(
      removedParticipants.filter((v: string) => v !== participant.identity),
    );

    const participantsCopy = data.meeting.participants.map(
      (p: MeetingParticipantType) => {
        if (p.id === participant.identity) {
          p.status = 'IN_CALL';
        }

        return p;
      },
    );
    const dataCopy = {
      meeting: {participants: participantsCopy},
    };
    setData(dataCopy);
  };

  const onRoomParticipantDidDisconnect = (participant: TwilioParticipant) => {
    console.log('onRoomParticipantDidDisconnect: ', participant);

    const twilioParticipantsCopy = twilioParticipants.filter(
      (v) => v.identity !== participant.identity,
    );

    setTwilioParticipants(twilioParticipantsCopy);

    // todo: remove in speak app
    const participantsCopy = data.meeting.participants.map(
      (p: MeetingParticipantType) => {
        if (p.id === participant.identity) {
          p.status = 'HANGUP';
        }

        return p;
      },
    );
    const dataCopy = {
      meeting: {participants: participantsCopy},
    };
    setData(dataCopy);
  };

  const handleSubmit = () => {
    const twilioUser = twilioParticipants.find(
      (v: TwilioParticipant) => v.identity === connectingUser,
    );
    const meetingParticipant = data.meeting.participants.find(
      (v) => v.id === connectingUser,
    );

    if (connectingUser !== user.identity && !twilioUser && meetingParticipant) {
      onRoomParticipantDidConnect({
        sid: `sid_${meetingParticipant.id}`,
        identity: meetingParticipant.id,
      });
    }
  };

  const participantsBoxes = [...offlineParticipants, ...twilioParticipants];
  const renderItem = ({item}: {item: VideoParticipant}) => {
    const participantInfo = data.meeting.participants.find(
      (v) => v.id === item.identity,
    );

    if (participantInfo) {
      return (
        <View style={styles.item}>
          <Text
            style={
              styles.title
            }>{`${participantInfo.id}:${participantInfo.name} (${participantInfo.status})`}</Text>
          {participantInfo &&
            !statusToRemoveParticipant.includes(participantInfo.status) && (
              <Button
                disabled={participantInfo.id === user.identity}
                onPress={() => onRoomParticipantDidDisconnect(item)}
                title="Disconnect"
                color="#ffffff"
                accessibilityLabel="Disconnect this user"
              />
            )}
        </View>
      );
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={styles.scrollView}>
          <Header />
          <View style={styles.body}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="user id"
                maxLength={20}
                onBlur={Keyboard.dismiss}
                onChangeText={(id: string) => setConnectingUser(id)}
              />
            </View>
            <View style={styles.inputContainer}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSubmit}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>

            {participantsBoxes.length > 0 && (
              <FlatList
                data={participantsBoxes}
                renderItem={renderItem}
                keyExtractor={(item) => item.identity}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: Colors.lighter,
  },
  engine: {
    position: 'absolute',
    right: 0,
  },
  body: {
    backgroundColor: Colors.white,
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.black,
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.dark,
  },
  highlight: {
    fontWeight: '700',
  },
  footer: {
    color: Colors.dark,
    fontSize: 12,
    fontWeight: '600',
    padding: 4,
    paddingRight: 12,
    textAlign: 'right',
  },
  inputContainer: {
    paddingTop: 15,
  },
  textInput: {
    borderColor: '#CCCCCC',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    height: 50,
    fontSize: 25,
    paddingLeft: 20,
    paddingRight: 20,
  },
  saveButton: {
    borderWidth: 1,
    borderColor: '#007BFF',
    backgroundColor: '#007BFF',
    padding: 15,
    margin: 5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    textAlign: 'center',
  },
  item: {
    backgroundColor: '#14248A',
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 32,
    color: '#FFFFFF',
  },
});

export default App;

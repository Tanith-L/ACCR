// Care Team tab: the After-Hours Notice and when to contact the care team.
// Static guidance (not lesson content), so it lives in the app rather than the
// database. Practice-neutral: a practice that enables messaging supplies its
// own hours and response-time wording.
import { router } from 'expo-router';
import { Text } from 'react-native';

import { AfterHoursNotice } from '@/components/AfterHoursNotice';
import { Button } from '@/components/Button';
import { InfoCard } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { contentService } from '@/content';
import { useAsync } from '@/hooks/useAsync';
import { type } from '@/theme';

/** The lessons on describing symptoms to the team, offered when that topic is published. */
const LESSONS_TOPIC_ID = 'contact';

export default function CareScreen() {
  const topics = useAsync(() => contentService.getTopics().catch(() => []), 'care');
  const lessons = topics.data?.find((t) => t.id === LESSONS_TOPIC_ID);

  return (
    <Screen>
      <Text style={type.display}>When to get help</Text>
      <AfterHoursNotice />
      <InfoCard title="Routine question">
        Medication instructions, appointment timing, or questions that can wait for a normal response.
      </InfoCard>
      <InfoCard title="Contact your care team soon">
        New or worsening swelling, pain, stiffness, skin changes, or possible medication side effects.
      </InfoCard>
      {lessons && (
        <Button
          label="Learn how to describe your symptoms"
          variant="outline"
          onPress={() =>
            router.navigate({ pathname: '/topic/[topicId]', params: { topicId: lessons.id, name: lessons.name } })
          }
        />
      )}
    </Screen>
  );
}

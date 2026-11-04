import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { loadChannelSettings } from "./channels";

export const CP_KEY = ["ChannelPost"];
export const YT_KEY = ["YouTubeVideo"];
export const CONV_KEY = ["SocialConversation"];
export const CH_SETTINGS_KEY = ["social-channels", "settings"];

export const useChannelPosts = () => useQuery({ queryKey: CP_KEY, queryFn: () => base44.entities.ChannelPost.list("-created_date", 500) });
export const useVideos = () => useQuery({ queryKey: YT_KEY, queryFn: () => base44.entities.YouTubeVideo.list("sort", 300) });
export const useConversations = () => useQuery({ queryKey: CONV_KEY, queryFn: () => base44.entities.SocialConversation.list("-created_date", 200) });
export const useChannelSettings = () => useQuery({ queryKey: CH_SETTINGS_KEY, queryFn: loadChannelSettings, staleTime: 10 * 60000 });

export const cp = {
  create: (d) => base44.entities.ChannelPost.create(d),
  update: (id, d) => base44.entities.ChannelPost.update(id, d),
  remove: (id) => base44.entities.ChannelPost.delete(id),
};
export const yt = {
  create: (d) => base44.entities.YouTubeVideo.create(d),
  update: (id, d) => base44.entities.YouTubeVideo.update(id, d),
  remove: (id) => base44.entities.YouTubeVideo.delete(id),
};
export const conv = {
  create: (d) => base44.entities.SocialConversation.create(d),
  update: (id, d) => base44.entities.SocialConversation.update(id, d),
  remove: (id) => base44.entities.SocialConversation.delete(id),
};

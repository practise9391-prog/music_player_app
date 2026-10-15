package com.novamusic.player;

import android.Manifest;
import android.content.ContentUris;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "MediaStoreScanner",
    permissions = {
        @Permission(
            alias = "audio",
            strings = {
                Manifest.permission.READ_MEDIA_AUDIO,
                Manifest.permission.READ_EXTERNAL_STORAGE
            }
        )
    }
)
public class MediaStoreScannerPlugin extends Plugin {

    private boolean hasAudioPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_AUDIO)
                    == PackageManager.PERMISSION_GRANTED;
        } else {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE)
                    == PackageManager.PERMISSION_GRANTED;
        }
    }

    @PluginMethod
    public void checkAudioPermission(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = hasAudioPermission();
        ret.put("granted", granted);
        ret.put("apiLevel", Build.VERSION.SDK_INT);
        ret.put("permissionRequired", Build.VERSION.SDK_INT >= 33 ? Manifest.permission.READ_MEDIA_AUDIO : Manifest.permission.READ_EXTERNAL_STORAGE);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestAudioPermission(PluginCall call) {
        if (hasAudioPermission()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        requestPermissionForAlias("audio", call, "audioPermissionCallback");
    }

    @PermissionCallback
    private void audioPermissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasAudioPermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open settings: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void scanAudioFiles(PluginCall call) {
        getBridge().execute(() -> {
            JSArray audioArray = new JSArray();
            Cursor cursor = null;
            try {
                Uri uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                String[] projection = new String[] {
                    MediaStore.Audio.Media._ID,
                    MediaStore.Audio.Media.DATA,
                    MediaStore.Audio.Media.TITLE,
                    MediaStore.Audio.Media.DURATION,
                    MediaStore.Audio.Media.ARTIST,
                    MediaStore.Audio.Media.ALBUM,
                    MediaStore.Audio.Media.SIZE,
                    MediaStore.Audio.Media.DATE_MODIFIED,
                    MediaStore.Audio.Media.DISPLAY_NAME,
                    MediaStore.Audio.Media.ALBUM_ID
                };

                // Comprehensive music selection: matches music flag or common audio file extensions,
                // while filtering out system sounds / ringtones shorter than 5 seconds.
                String selection = "(" + MediaStore.Audio.Media.IS_MUSIC + " != 0 OR " +
                        MediaStore.Audio.Media.DATA + " LIKE '%.mp3' OR " +
                        MediaStore.Audio.Media.DATA + " LIKE '%.flac' OR " +
                        MediaStore.Audio.Media.DATA + " LIKE '%.m4a' OR " +
                        MediaStore.Audio.Media.DATA + " LIKE '%.wav' OR " +
                        MediaStore.Audio.Media.DATA + " LIKE '%.aac' OR " +
                        MediaStore.Audio.Media.DATA + " LIKE '%.ogg') AND " +
                        MediaStore.Audio.Media.DURATION + " >= 5000";

                String sortOrder = MediaStore.Audio.Media.TITLE + " ASC";

                cursor = getContext().getContentResolver().query(
                    uri,
                    projection,
                    selection,
                    null,
                    sortOrder
                );

                if (cursor != null) {
                    int idCol = cursor.getColumnIndex(MediaStore.Audio.Media._ID);
                    int dataCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATA);
                    int titleCol = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE);
                    int durationCol = cursor.getColumnIndex(MediaStore.Audio.Media.DURATION);
                    int artistCol = cursor.getColumnIndex(MediaStore.Audio.Media.ARTIST);
                    int albumCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM);
                    int sizeCol = cursor.getColumnIndex(MediaStore.Audio.Media.SIZE);
                    int dateModifiedCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATE_MODIFIED);
                    int displayNameCol = cursor.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME);
                    int albumIdCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM_ID);

                    while (cursor.moveToNext()) {
                        long id = idCol != -1 ? cursor.getLong(idCol) : 0;
                        String path = dataCol != -1 ? cursor.getString(dataCol) : null;
                        String title = titleCol != -1 ? cursor.getString(titleCol) : null;
                        long durationMs = durationCol != -1 ? cursor.getLong(durationCol) : 0;
                        String artist = artistCol != -1 ? cursor.getString(artistCol) : null;
                        String album = albumCol != -1 ? cursor.getString(albumCol) : null;
                        long size = sizeCol != -1 ? cursor.getLong(sizeCol) : 0;
                        long dateModified = dateModifiedCol != -1 ? cursor.getLong(dateModifiedCol) : 0;
                        String displayName = displayNameCol != -1 ? cursor.getString(displayNameCol) : null;
                        long albumId = albumIdCol != -1 ? cursor.getLong(albumIdCol) : -1;

                        if (path == null && id > 0) {
                            Uri contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                            path = contentUri.toString();
                        }

                        if (path == null) continue;

                        JSObject trackObj = new JSObject();
                        trackObj.put("id", String.valueOf(id));
                        trackObj.put("path", path);
                        trackObj.put("title", title != null && !title.trim().isEmpty() ? title : (displayName != null ? displayName : "Unknown Title"));
                        trackObj.put("artist", artist != null && !artist.equals("<unknown>") && !artist.trim().isEmpty() ? artist : "Unknown Artist");
                        trackObj.put("album", album != null && !album.equals("<unknown>") && !album.trim().isEmpty() ? album : "Unknown Album");
                        trackObj.put("duration", durationMs > 0 ? durationMs / 1000.0 : 0);
                        trackObj.put("fileSize", size);
                        trackObj.put("modifiedAt", dateModified > 0 ? dateModified * 1000 : System.currentTimeMillis());
                        trackObj.put("displayName", displayName != null ? displayName : (title != null ? title : "track.mp3"));

                        Uri contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                        trackObj.put("contentUri", contentUri.toString());

                        if (albumId >= 0) {
                            Uri albumArtUri = ContentUris.withAppendedId(Uri.parse("content://media/external/audio/albumart"), albumId);
                            trackObj.put("albumArtUri", albumArtUri.toString());
                        }

                        audioArray.put(trackObj);
                    }
                }

                JSObject result = new JSObject();
                result.put("tracks", audioArray);
                result.put("count", audioArray.length());
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Failed to query MediaStore: " + e.getMessage(), e);
            } finally {
                if (cursor != null) {
                    cursor.close();
                }
            }
        });
    }
}

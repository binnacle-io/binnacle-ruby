require 'spec_helper'
require 'open3'

describe "binnacle command" do
  it 'returns an error message for unknown subcommands' do
    expect(`binnacle foo`).to eq("I don't know the subcommand command 'foo'\n")
  end

  it 'returns the help for the binnacle tail sub command' do
    expected_output = [
      %[Usage:],
      %[   binnacle tail\n],
      %[where [options] are:],
      %[  -h, --host=<s>                     Binnacle Host (default: localhost)],
      %[  -c, --context=<s>                  Binnacle Context],
      %[  -a, --app=<s>                      Binnacle App],
      %[  -u, --api-key=<s>                  Binnacle API Key],
      %[  -p, --api-secret=<s>               Binnacle API Secret],
      %[  -f, --follow                       Monitors a Binnacle Context or App],
      %[  -n, --lines=<i>                    Get the last n events on the Channel],
      %[  -s, --since=<i>                    Number of minutes in the past to search],
      %[                                     for events],
      %[  -e, --encrypted, --no-encrypted    Use SSL/HTTPS (default: true)],
      %[  -l, --help                         Show this message\n]
    ].join("\n")
    expect(`binnacle tail --help`).to eq(expected_output)
  end

  it 'with -n flag returns recent events', :vcr do
    ENV["TEST_MODE"] = 'true'
    args = ["tail", "-n", "10", "-s", "60", "--host=localhost", "--context=ylhcn28x7skv6av8q93m", "--api-key=jzr5d5kgj4j3l8fm90tr", "--api-secret=bz3e3w44o3323dypp8d7", "--encrypted=false"]

    expected_output = [
      %[Retrieving last 10 lines since 60 minutes ago from Context ylhcn28x7skv6av8q93m ...],
      %[INFO [#{Time.strptime("2015-10-22 13:37:28 -0700", "%Y-%m-%d %H:%M:%S %z").getlocal}] TEST_EVT2 :: clientId=io, sessionId=SESS_01, tags=[\"account\", \"upgrade\"]],
      %[INFO [#{Time.strptime("2015-10-22 13:37:32 -0700", "%Y-%m-%d %H:%M:%S %z").getlocal}] TEST_EVT2 :: clientId=io, sessionId=SESS_01, tags=[\"account\", \"upgrade\"]],
      %[INFO [#{Time.strptime("2015-10-22 13:37:32 -0700", "%Y-%m-%d %H:%M:%S %z").getlocal}] TEST_EVT2 :: clientId=io, sessionId=SESS_01, tags=[\"account\", \"upgrade\"]],
      %[INFO [#{Time.strptime("2015-10-22 13:37:33 -0700", "%Y-%m-%d %H:%M:%S %z").getlocal}] TEST_EVT2 :: clientId=io, sessionId=SESS_01, tags=[\"account\", \"upgrade\"]],
      %[INFO [#{Time.strptime("2015-10-22 13:37:36 -0700", "%Y-%m-%d %H:%M:%S %z").getlocal}] TEST_EVT2 :: clientId=io, sessionId=SESS_01, tags=[\"account\", \"upgrade\"]\n]
    ].join("\n")

    expect { BinnacleCommand.new.run(args) }.to output(expected_output).to_stdout

    expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
    expect(
      a_request(:get, "http://localhost:8080/api/events/ylhcn28x7skv6av8q93m/recents?limit=10&since=60")
    ).to(have_been_made.times(1))
  end

end

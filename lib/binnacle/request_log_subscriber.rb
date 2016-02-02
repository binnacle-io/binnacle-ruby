require 'json'
require 'action_pack'
require 'active_support/core_ext/class/attribute'
require 'active_support/log_subscriber'

module Binnacle
  module Logging
    class RequestLogSubscriber < ActiveSupport::LogSubscriber
      def process_action(event)
        return if Binnacle.configuration.ignore?(event)
        payload = event.payload
        data = extract_request(event, payload)
        Binnacle.client.log_rails_event(data)
      end

      def redirect_to(event)
        Thread.current[:binnacle_location] = event.payload[:location]
      end

      # TODO: Implement send_file and send_data
      # def send_file(event)
      #   info { "Sent data #{event.payload[:filename]} (#{event.duration.round(1)}ms)" }
      # end
      #
      # def send_data(event)
      #   info { "Sent data #{event.payload[:filename]} (#{event.duration.round(1)}ms)" }
      # end

      def unpermitted_parameters(event)
        Thread.current[:binnacle_unpermitted_params] ||= []
        Thread.current[:binnacle_unpermitted_params].concat(event.payload[:keys])
      end

      private

      def extract_request(event, payload)
        payload = event.payload
        data = initial_data(payload)
        data.merge!(extract_status(payload))
        data.merge!(extract_runtimes(event, payload))
        data.merge!(extract_location)
        data.merge!(extract_unpermitted_params)
        data.merge!(extract_event_details(event))
        data.merge!({message: "#{data[:method]} #{data[:path]} AS #{data[:format]} (view: #{data[:view]}ms, db: #{data[:db]}ms)"})
      end

      def initial_data(payload)
        path = extract_path(payload)
        method = payload[:method]
        format = extract_format(payload)
        {
          direction: :in,
          method: method,
          path: path,
          format: format,
          controller: payload[:params]['controller'],
          action: payload[:params]['action'],
          params: payload[:params],
        }
      end

      def extract_path(payload)
        path = payload[:path]
        index = path.index('?')
        index ? path[0, index] : path
      end

      def extract_event_details(event)
        {
          time: event.time,
          transaction_id: event.transaction_id
        }
      end

      def extract_format(payload)
        (::ActionPack::VERSION::MAJOR == 3 && ::ActionPack::VERSION::MINOR == 0) ? payload[:formats].first : payload[:format]
      end

      def extract_status(payload)
        if (status = payload[:status])
          { status: status.to_i }
        elsif (error = payload[:exception])
          exception, message = error
          { status: get_error_status_code(exception), error: "#{exception}: #{message}" }
        else
          { status: 0 }
        end
      end

      def get_error_status_code(exception)
        status = ActionDispatch::ExceptionWrapper.rescue_responses[exception]
        Rack::Utils.status_code(status)
      end

      def extract_runtimes(event, payload)
        data = { duration: event.duration.to_f.round(2) }
        data[:view] = payload[:view_runtime].to_f.round(2) if payload.key?(:view_runtime)
        data[:db] = payload[:db_runtime].to_f.round(2) if payload.key?(:db_runtime)
        data
      end

      def extract_location
        location = Thread.current[:binnacle_location]
        return {} unless location

        Thread.current[:binnacle_location] = nil
        { location: location }
      end

      def extract_unpermitted_params
        unpermitted_params = Thread.current[:binnacle_unpermitted_params]
        return {} unless unpermitted_params

        Thread.current[:binnacle_unpermitted_params] = nil
        { unpermitted_params: unpermitted_params }
      end

    end
  end
end
